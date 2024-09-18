export const removePrefix = (text: string): string => {
  const parts = text.split('-');
  return parts.length > 1 ? parts[1] : text;
};
