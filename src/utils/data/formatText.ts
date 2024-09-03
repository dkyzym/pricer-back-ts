export const formatText = (text: string) => {
  const removeGaps = text.replace(/[^\w]/g, '').trim();

  const lowerCaseWithLettersOnly = removeGaps.toLowerCase();

  return lowerCaseWithLettersOnly;
};
