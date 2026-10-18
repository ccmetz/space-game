import { createStore } from '../state.ts';

// These are proposed bonuses for the class preview; gameplay does not apply them yet.
export const classes = [
  {
    id: 'explorer',
    name: 'Explorer',
    symbol: '◇',
    role: 'Find a way forward.',
    description:
      'A pathfinder at home beyond the shipping lanes. You read unfamiliar worlds and seek out the resources others miss.',
    specialty: 'Surveying · Navigation · Discovery',
    bonuses: { scanning: 25, salvage: 10, health: 0 },
  },
  {
    id: 'engineer',
    name: 'Engineer',
    symbol: '⌘',
    role: 'Keep the frontier running.',
    description:
      'A practical problem solver who sees possibility in scrap. You turn raw materials into the things a settlement needs.',
    specialty: 'Salvage · Crafting · Repairs',
    bonuses: { scanning: 10, salvage: 25, health: 0 },
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    symbol: '△',
    role: 'Be the first through.',
    description:
      'A steady hand when an expedition goes wrong. You protect your crew and push deeper into dangerous territory.',
    specialty: 'Defense · Survival · Security',
    bonuses: { scanning: 0, salvage: 10, health: 25 },
  },
] as const;
export const skinTones = [
  { id: 'sand', name: 'Sand', color: '#e5b997' },
  { id: 'warm', name: 'Warm', color: '#c68b65' },
  { id: 'umber', name: 'Umber', color: '#946344' },
  { id: 'deep', name: 'Deep', color: '#593d30' },
] as const;
export const hairColors = [
  { id: 'dark', name: 'Midnight', color: '#25272d' },
  { id: 'brown', name: 'Chestnut', color: '#654135' },
  { id: 'silver', name: 'Silver', color: '#c9cfcd' },
  { id: 'copper', name: 'Copper', color: '#ad5937' },
] as const;
export const suitColors = [
  { id: 'sage', name: 'Sage', color: '#8fae9d' },
  { id: 'blue', name: 'Cobalt', color: '#527ea6' },
  { id: 'rust', name: 'Rust', color: '#bb7057' },
  { id: 'ivory', name: 'Ivory', color: '#d4ccba' },
] as const;
export const hairStyles = [
  { id: 'crop', name: 'Crop' },
  { id: 'swept', name: 'Swept' },
  { id: 'shaved', name: 'Shaved' },
  { id: 'bob', name: 'Bob' },
  { id: 'long', name: 'Long' },
  { id: 'curls', name: 'Curls' },
  { id: 'bun', name: 'Bun' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'bald', name: 'Bald' },
] as const;

export interface Character {
  name: string;
  classId: string;
  skin: string;
  hair: string;
  hairstyle: string;
  suit: string;
  confirmed: boolean;
  saved: boolean;
}

export function createCharacter(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'> = () => localStorage,
) {
  const initial: Character = {
    name: '',
    classId: 'explorer',
    skin: 'sand',
    hair: 'dark',
    hairstyle: 'crop',
    suit: 'sage',
    confirmed: false,
    saved: true,
  };
  const options = {
    classId: classes,
    skin: skinTones,
    hair: hairColors,
    hairstyle: hairStyles,
    suit: suitColors,
  };
  try {
    const storage = getStorage();
    initial.name = (storage.getItem('starbound.character.name') ?? '').slice(0, 24);
    // Check saved choices against the catalog so older saves can't break the preview.
    for (const key of Object.keys(options) as (keyof typeof options)[]) {
      const saved = storage.getItem(`starbound.character.${key}`);
      initial[key] = options[key].find((option) => option.id === saved)?.id ?? initial[key];
    }
  } catch {
    // Registration still works when the browser blocks local storage.
  }
  const store = createStore(initial);
  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    setName: (name: string) => store.update({ name: name.slice(0, 24) }),
    choose(key: keyof typeof options, id: string) {
      if (options[key].some((option) => option.id === id)) store.update({ [key]: id });
    },
    edit: () => store.update({ confirmed: false }),
    confirm() {
      const name = store.getSnapshot().name.trim();
      if (!name) return false;
      store.update({ name });
      let saved = true;
      try {
        const storage = getStorage();
        for (const key of ['name', ...Object.keys(options)] as (keyof Character)[]) {
          storage.setItem(`starbound.character.${key}`, String(store.getSnapshot()[key]));
        }
      } catch {
        // Keep the character in this session even if saving fails.
        saved = false;
      }
      store.update({ confirmed: true, saved });
      return true;
    },
  };
}
