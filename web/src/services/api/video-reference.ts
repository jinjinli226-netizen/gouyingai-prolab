export function openAIVideoReferenceImageField(model: string) {
    return /^minimax-h3(?:-|$)/i.test(model.trim()) ? "reference_images" : "input_reference[]";
}

export function openAIVideoReferenceImageLimit(model: string) {
    return /^minimax-h3-autodl(?:-|$)/i.test(model.trim()) ? 9 : 7;
}

export function openAIVideoReferenceAudioField(model: string) {
    return /^minimax-h3-autodl(?:-|$)/i.test(model.trim()) ? "reference_audios" : "";
}

export function openAIVideoReferenceAudioLimit(model: string) {
    return /^minimax-h3-autodl(?:-|$)/i.test(model.trim()) ? 3 : 0;
}
