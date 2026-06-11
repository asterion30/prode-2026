// Common Spanish profanities list for validation
const SPANISH_PROFANITIES = [
  'mierda', 'puto', 'puta', 'boludo', 'pelotudo', 'concha', 'choto',
  'orto', 'forro', 'forra', 'pajero', 'pajera', 'cagar', 'carajo', 
  'culiado', 'culia', 'teta', 'pito', 'chota', 'mamon', 'pendejo', 
  'pendeja', 'tarado', 'tarada', 'trolo', 'cagon', 'cagona', 'forro',
  'hijo de puta', 'hdp', 'la concha', 'culon', 'culona', 'forros'
];

/**
 * Validates a participant name.
 * Checks for character rules (only letters and spaces) and filters out Spanish profanities.
 * 
 * @param {string} name - The input name to validate.
 * @returns {object} - { isValid: boolean, cleanName?: string, error?: string }
 */
export const validateParticipantName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'El nombre es obligatorio.' };
  }

  const cleanName = name.trim().replace(/\s+/g, ' '); // Normalize spaces
  
  if (cleanName.length < 2) {
    return { isValid: false, error: 'El nombre debe tener al menos 2 letras.' };
  }

  if (cleanName.length > 30) {
    return { isValid: false, error: 'El nombre es demasiado largo (máximo 30 letras).' };
  }

  // Regex to match only letters, accents, ñ, and spaces
  const letterRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
  if (!letterRegex.test(cleanName)) {
    return { isValid: false, error: 'El nombre debe contener únicamente letras y espacios.' };
  }

  // Check for profanity
  const lowerName = cleanName.toLowerCase();
  
  const hasProfanity = SPANISH_PROFANITIES.some(badWord => {
    // Check if the bad word is included as a standalone word or direct substring
    const regex = new RegExp(`\\b${badWord}\\b`, 'i');
    return regex.test(lowerName) || lowerName.includes(badWord);
  });

  if (hasProfanity) {
    return { isValid: false, error: 'Por favor, ingresá un nombre válido y respetuoso.' };
  }

  return { isValid: true, cleanName };
};
