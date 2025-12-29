// Basic profanity filter - feel free to customize the word list
const badWords = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "damn",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "slut",
  "whore",
  "fag",
  "nigger",
  "retard",
  // Add more as needed
];

export function filterProfanity(text: string): string {
  let filtered = text;

  badWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });

  return filtered;
}

export function containsProfanity(text: string): boolean {
  return badWords.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(text);
  });
}
