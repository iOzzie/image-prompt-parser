export interface FriendlyMetadata {
  positivePrompt?: string;
  negativePrompt?: string;
  generationParams?: Record<string, string | number>;
  modelName?: string;
  isRecognized: boolean;
  generator?: 'ComfyUI' | 'A1111/WebUI' | 'Unknown';
}

export const extractFriendlyData = (metadata: Record<string, any>): FriendlyMetadata => {
  const result: FriendlyMetadata = { isRecognized: false };

  // Check for ComfyUI
  if (metadata.prompt && typeof metadata.prompt === 'object') {
    result.isRecognized = true;
    result.generator = 'ComfyUI';

    const promptObj = metadata.prompt;
    let mainSampler: any = null;
    let ckptNode: any = null;

    // Extract basic generation params from the first sampler we find
    for (const key in promptObj) {
      const node = promptObj[key];
      if (!node?.class_type) continue;

      if (!mainSampler && (node.class_type.includes('Sampler') || node.class_type === 'KSampler')) {
        mainSampler = node;
      }
      if (!ckptNode && (node.class_type.includes('CheckpointLoader') || node.class_type === 'UNETLoader')) {
        ckptNode = node;
      }
    }

    if (mainSampler) {
      result.generationParams = {
        Seed: mainSampler.inputs?.seed ?? mainSampler.inputs?.noise_seed,
        Steps: mainSampler.inputs?.steps,
        CFG: mainSampler.inputs?.cfg,
        Sampler: mainSampler.inputs?.sampler_name,
        Scheduler: mainSampler.inputs?.scheduler,
        Denoise: mainSampler.inputs?.denoise,
      };

      Object.keys(result.generationParams).forEach(
        key => result.generationParams![key] === undefined && delete result.generationParams![key]
      );
    }

    if (ckptNode) {
      result.modelName = ckptNode.inputs?.ckpt_name || ckptNode.inputs?.unet_name;
    }

    // --- PROMPT EXTRACTION ---
    let posTexts: string[] = [];
    let negTexts: string[] = [];

    // Helper: Recursive graph walker to find strings
    const findClipTexts = (nodeId: string, searchType: 'positive' | 'negative' | 'any', visited = new Set<string>()): string[] => {
      if (!nodeId || visited.has(String(nodeId))) return [];
      visited.add(String(nodeId));

      const node = promptObj[String(nodeId)];
      if (!node) return [];

      let results: string[] = [];

      // Heuristic: If we know what we are searching for and the node explicitly has both, grab the right one
      if (searchType === 'positive' && typeof node.inputs?.text_positive === 'string') {
        results.push(node.inputs.text_positive);
      } else if (searchType === 'negative' && typeof node.inputs?.text_negative === 'string') {
        results.push(node.inputs.text_negative);
      } else if (searchType === 'positive' && typeof node.inputs?.positive === 'string') {
        results.push(node.inputs.positive);
      } else if (searchType === 'negative' && typeof node.inputs?.negative === 'string') {
        results.push(node.inputs.negative);
      } else {
        // Generic extraction
        const textFields = ['text', 'text_g', 'text_l', 'string', 'value', 'prompt', 'Text'];
        for (const field of textFields) {
          const val = node.inputs?.[field];
          if (typeof val === 'string' && val.trim().length > 0) {
            if (!val.match(/\.(safetensors|ckpt|pt|pth|bin)$/)) {
              results.push(val.trim());
            }
          }
        }
      }

      // Follow links
      for (const [key, value] of Object.entries(node.inputs || {})) {
        if (Array.isArray(value) && value.length > 0) {
          // Prevent crossing over to the opposite conditioning path if explicitly defined
          if (searchType === 'positive' && (key === 'negative' || key === 'text_negative')) continue;
          if (searchType === 'negative' && (key === 'positive' || key === 'text_positive')) continue;

          results = results.concat(findClipTexts(String(value[0]), searchType, visited));
        }
      }
      return results;
    };

    // 1. Trace from any node that takes 'positive' or 'negative' inputs (like KSampler)
    const conditioningNodes = Object.values(promptObj).filter((n: any) => n?.inputs?.positive || n?.inputs?.negative);
    for (const n of conditioningNodes) {
      const node = n as any;
      const posId = Array.isArray(node.inputs?.positive) ? node.inputs.positive[0] : null;
      const negId = Array.isArray(node.inputs?.negative) ? node.inputs.negative[0] : null;

      if (posId) posTexts = posTexts.concat(findClipTexts(String(posId), 'positive'));
      if (negId) negTexts = negTexts.concat(findClipTexts(String(negId), 'negative'));
    }

    // 2. Direct scan for custom nodes
    for (const node of Object.values(promptObj) as any[]) {
      if (typeof node?.inputs?.text_positive === 'string') posTexts.push(node.inputs.text_positive);
      if (typeof node?.inputs?.text_negative === 'string') negTexts.push(node.inputs.text_negative);
      if (typeof node?.inputs?.positive === 'string') posTexts.push(node.inputs.positive);
      if (typeof node?.inputs?.negative === 'string') negTexts.push(node.inputs.negative);
    }

    // Combine and clean up
    const cleanPos = [...new Set(posTexts)].filter(Boolean).join('\n\n').trim();
    const cleanNeg = [...new Set(negTexts)].filter(Boolean).join('\n\n').trim();

    if (cleanPos) result.positivePrompt = cleanPos;
    if (cleanNeg) result.negativePrompt = cleanNeg;

    // 3. Ultimate Fallback: Just grab any text from CLIPTextEncode nodes if still missing
    if (!result.positivePrompt || !result.negativePrompt) {
      const clipNodes = Object.values(promptObj).filter((n: any) => n?.class_type?.includes('CLIPTextEncode'));
      const fallbackTexts: string[] = [];
      for (const n of clipNodes as any[]) {
        if (typeof n.inputs?.text === 'string') fallbackTexts.push(n.inputs.text);
        if (typeof n.inputs?.text_g === 'string') fallbackTexts.push(n.inputs.text_g);
      }

      const uniqueFallback = [...new Set(fallbackTexts)]
        .map(t => t.trim())
        .filter(t => t && t !== result.positivePrompt && t !== result.negativePrompt);

      if (!result.positivePrompt && uniqueFallback.length >= 1) {
        result.positivePrompt = uniqueFallback[0];
        uniqueFallback.shift(); // Remove it so negative doesn't grab it too
      }
      if (!result.negativePrompt && uniqueFallback.length >= 1) {
        result.negativePrompt = uniqueFallback[0];
      }
    }

    // 4. THE ULTIMATE BRUTE FORCE
    // If the prompt is completely missing from the execution graph (e.g., hidden in a disconnected custom node or UI-only 'workflow' object)
    if (!result.positivePrompt || !result.negativePrompt) {
      const allStrings = new Set<string>();

      const scanObject = (obj: any) => {
        if (typeof obj === 'string') {
          const trimmed = obj.trim();
          // Filter out system strings, code, paths, or JSON strings
          if (trimmed.length > 15
            && !trimmed.match(/\.(safetensors|ckpt|pt|pth|bin)$/i)
            && !trimmed.includes('function(')
            && !trimmed.startsWith('import ')
            && !trimmed.startsWith('{')
            && !trimmed.startsWith('[')) {
            allStrings.add(trimmed);
          }
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(scanObject);
        }
      };

      // Scan both the execution prompt and the UI workflow representation
      scanObject(metadata.prompt);
      scanObject(metadata.workflow);

      const candidates = [...allStrings].filter(s =>
        s !== result.positivePrompt &&
        s !== result.negativePrompt &&
        s !== result.modelName
      );

      // Sort by length, longest first (prompts are usually the longest strings in the file)
      candidates.sort((a, b) => b.length - a.length);

      if (!result.positivePrompt && candidates.length > 0) {
        result.positivePrompt = candidates[0];
        candidates.shift();
      }

      if (!result.negativePrompt && candidates.length > 0) {
        result.negativePrompt = candidates[0];
      }
    }

    if (ckptNode) {
      result.modelName = ckptNode.inputs?.ckpt_name || ckptNode.inputs?.unet_name;
    }

    return result;
  }

  // Check for A1111 (Automatic1111 / Stable Diffusion WebUI)
  if (metadata.parameters && typeof metadata.parameters === 'string') {
    result.isRecognized = true;
    result.generator = 'A1111/WebUI';

    const paramsString = metadata.parameters;
    const parts = paramsString.split('\nNegative prompt:');

    if (parts.length > 1) {
      result.positivePrompt = parts[0].trim();
      const nextParts = parts[1].split('\nSteps:');
      result.negativePrompt = nextParts[0].trim();

      if (nextParts.length > 1) {
        const paramStr = 'Steps:' + nextParts[1];
        result.generationParams = {};
        paramStr.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          if (k && v) {
            result.generationParams![k.trim()] = v.trim();
          }
        });
      }
    } else {
      // Just a simple prompt maybe?
      result.positivePrompt = paramsString.trim();
    }

    return result;
  }

  return result;
};
