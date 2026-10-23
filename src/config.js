// Shared constants.

export const FONT_FAMILIES = [
  ['Bricolage Grotesque', "'Bricolage Grotesque', sans-serif"],
  ['Figtree', "'Figtree', sans-serif"],
  ['Inter', "'Inter', sans-serif"],
  ['Poppins', "'Poppins', sans-serif"],
  ['Montserrat', "'Montserrat', sans-serif"],
  ['DM Sans', "'DM Sans', sans-serif"],
  ['Space Grotesk', "'Space Grotesk', sans-serif"],
  ['Raleway', "'Raleway', sans-serif"],
  ['Roboto', "'Roboto', sans-serif"],
  ['Open Sans', "'Open Sans', sans-serif"],
  ['Oswald', "'Oswald', sans-serif"],
  ['Bebas Neue', "'Bebas Neue', sans-serif"],
  ['Playfair Display', "'Playfair Display', serif"],
  ['Lora', "'Lora', serif"],
  ['Merriweather', "'Merriweather', serif"],
  ['Pacifico', "'Pacifico', cursive"],
  ['Arial', 'Arial, Helvetica, sans-serif'],
  ['Georgia', 'Georgia, serif'],
  ['Courier New', "'Courier New', monospace"],
];

export const FONTS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700',
    'family=Figtree:wght@400;500;600;700',
    'family=Inter:wght@400;500;600;700',
    'family=Poppins:wght@400;500;600;700',
    'family=Montserrat:wght@400;500;600;700',
    'family=DM+Sans:wght@400;500;700',
    'family=Space+Grotesk:wght@400;500;700',
    'family=Raleway:wght@400;500;700',
    'family=Roboto:wght@400;500;700',
    'family=Open+Sans:wght@400;600;700',
    'family=Oswald:wght@400;500;700',
    'family=Bebas+Neue',
    'family=Playfair+Display:wght@400;600;700',
    'family=Lora:wght@400;600;700',
    'family=Merriweather:wght@400;700',
    'family=Pacifico',
  ].join('&') +
  '&display=swap';

// Width of the area freeform elements live in, and the screen width below which strips stack.
export const STAGE_WIDTH = 900;

export const DEVICES = [
  { id: 'desktop', name: 'Desktop' },
  { id: 'tablet', name: 'Tablet', width: '820px', widthMedia: '992px' },
  { id: 'mobile', name: 'Mobile', width: '390px', widthMedia: '480px' },
];
