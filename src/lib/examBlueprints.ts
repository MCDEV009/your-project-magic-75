/**
 * ALKHARAZMIY XYZ — BMBA rasmiy mock imtihon blueprintlari.
 * Har bir fan 3 blokdan iborat: yopiq testlar, moslashtirish, ochiq/yozma savollar.
 */

export type BlockStyle = 'mcq' | 'matching' | 'written';

export interface BlueprintBlock {
  style: BlockStyle;
  label: string;
  from: number;
  to: number;
  /** AI generatsiyasi uchun qo'shimcha ko'rsatma */
  instruction: string;
}

export interface SubjectBlueprint {
  key: string;
  name: string;
  emoji: string;
  durationMinutes: number;
  totalQuestions: number;
  blocks: BlueprintBlock[];
  topics: string;
}

export interface SubjectCategory {
  key: string;
  title: string;
  emoji: string;
  subjects: SubjectBlueprint[];
}

function standardBlocks(
  mcqInstruction: string,
  matchingInstruction: string,
  writtenInstruction: string,
): BlueprintBlock[] {
  return [
    { style: 'mcq', label: "Blok 1: Yopiq testlar", from: 1, to: 32, instruction: mcqInstruction },
    { style: 'matching', label: 'Blok 2: Moslashtirish', from: 33, to: 35, instruction: matchingInstruction },
    { style: 'written', label: 'Blok 3: Ochiq / Yozma savollar', from: 36, to: 45, instruction: writtenInstruction },
  ];
}

const base = (
  key: string,
  name: string,
  emoji: string,
  topics: string,
  blocks: BlueprintBlock[],
): SubjectBlueprint => ({
  key, name, emoji, topics, blocks,
  durationMinutes: 180,
  totalQuestions: 45,
});

export const EXAM_CATEGORIES: SubjectCategory[] = [
  {
    key: 'exact',
    title: 'Aniq va Tabiiy Fanlar',
    emoji: '📐',
    subjects: [
      base('matematika', 'Matematika', '∑',
        'algebra, tenglamalar va tengsizliklar, funksiyalar, progressiyalar, planimetriya, stereometriya, trigonometriya, kombinatorika va ehtimollik',
        standardBlocks(
          "Barcha matematik ifodalarni LaTeX bilan $...$ ichida yozing. Hisob-kitob va isbot talab qiladigan savollar bo'lsin.",
          "Har bir savol ikki ustunni (1-2-3-4 va A-B-C-D) moslashtirishni talab qilsin; variantlar '1-A, 2-C, 3-D, 4-B' ko'rinishida berilsin. LaTeX ishlating.",
          "Har bir masala ko'p bosqichli yechim talab qilsin, a va b shartlari bilan. LaTeX ishlating.",
        )),
      base('fizika', 'Fizika', '⚛',
        'mexanika, molekulyar fizika va termodinamika, elektr va magnetizm, optika, atom va yadro fizikasi',
        standardBlocks(
          "Formulalar va son bilan hisoblanadigan masalalar ustun bo'lsin, birliklar SI da. LaTeX ishlating.",
          "Kattalik–birlik, hodisa–qonun, formula–ma'no juftliklarini moslashtirish savollari bo'lsin.",
          "Ochiq sonli masalalar: berilganlar, yechim bosqichlari va javob talab qilinsin (a va b shartlari).",
        )),
      base('kimyo', 'Kimyo', '⚗',
        'atom tuzilishi, davriy sistema, kimyoviy bog\'lanish, reaksiya tenglamalari, eritmalar, organik kimyo',
        standardBlocks(
          "Reaksiya tenglamalari va stexiometrik hisoblashlarga oid savollar bo'lsin.",
          "Modda–sinf, reaksiya–turi, formula–nomi juftliklarini moslashtirish savollari bo'lsin.",
          "Hisoblash masalalari: massa ulushi, mol, unum (a va b shartlari bilan).",
        )),
      base('biologiya', 'Biologiya', '🧬',
        'hujayra biologiyasi, botanika, zoologiya, odam anatomiyasi, genetika va ekologiya',
        standardBlocks(
          "Tuzilma va funksiya tahliliga oid savollar bo'lsin.",
          "Organ–vazifa, organizm–sistematik guruh, kasallik–sabab juftliklarini moslashtirish.",
          "Genetik masalalar va tuzilmaviy tahlil (a va b shartlari bilan).",
        )),
    ],
  },
  {
    key: 'humanities',
    title: 'Gumanitar Fanlar',
    emoji: '📚',
    subjects: [
      base('ona_tili', "O'zbek Tili va Adabiyot", '✍',
        'fonetika, leksikologiya, morfologiya, sintaksis, matn tahlili, adabiy asarlar va mualliflar',
        standardBlocks(
          "Matnni tushunish va grammatik tahlilga oid savollar bo'lsin.",
          "Asar–muallif, atama–ta'rif, so'z–turkum juftliklarini moslashtirish.",
          "Qisqa tahliliy yozma javob talab qiladigan topshiriqlar (a va b shartlari).",
        )),
      base('tarix', 'Tarix', '🏛',
        "O'zbekiston tarixi va jahon tarixi: qadimgi davr, o'rta asrlar, yangi va eng yangi davr",
        standardBlocks(
          "Sana, voqea va shaxslarga oid aniq savollar bo'lsin.",
          "Voqea–sana, shaxs–faoliyat, davlat–poytaxt juftliklarini moslashtirish.",
          "Manba tahlili va tarixiy baholash talab qiladigan ochiq savollar (a va b shartlari).",
        )),
      base('ingliz_tili', "Ingliz Tili (CEFR)", '🌐',
        'reading comprehension, grammar, vocabulary, use of English (B1–C1 CEFR)',
        standardBlocks(
          'Grammar and vocabulary gap-fill items with four options.',
          'Matching items: word–definition, sentence half–half, heading–paragraph. Options like "1-A, 2-C, 3-D, 4-B".',
          'Short written response / mini-essay prompts with parts a and b.',
        )),
      base('geografiya', 'Geografiya', '🗺',
        "tabiiy geografiya, iqtisodiy geografiya, O'zbekiston geografiyasi, xaritashunoslik",
        standardBlocks(
          "Xarita va mintaqaviy ma'lumotlarga oid savollar bo'lsin.",
          "Davlat–poytaxt, mintaqa–resurs, daryo–havza juftliklarini moslashtirish.",
          "Tahliliy qisqa javob talab qiladigan savollar (a va b shartlari).",
        )),
    ],
  },
];

export function findBlueprint(key: string): SubjectBlueprint | undefined {
  for (const c of EXAM_CATEGORIES) {
    const s = c.subjects.find((x) => x.key === key);
    if (s) return s;
  }
  return undefined;
}