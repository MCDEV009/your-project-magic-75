/**
 * ALKHARAZMIY XYZ — BMBA rasmiy mock imtihon blueprintlari.
 * Har bir fan o'z rasmiy tuzilishiga ega: aniq fanlar 45 savol (3 blok),
 * ona tili 45 savol + esse, tarix 45 savol (3 qism), chet tillari 4 bo'lim.
 */

export type BlockStyle = 'mcq' | 'matching' | 'written' | 'essay' | 'listening' | 'reading' | 'speaking';

export interface BlueprintBlock {
  style: BlockStyle;
  label: string;
  from: number;
  to: number;
  /** AI generatsiyasi uchun qo'shimcha ko'rsatma */
  instruction: string;
  /** Hozircha ishlab chiqilmagan bo'lim (masalan Speaking) */
  comingSoon?: boolean;
}

export interface StudyResource {
  label: string;
  url: string;
}

export interface SubjectBlueprint {
  key: string;
  name: string;
  emoji: string;
  durationMinutes: number;
  totalQuestions: number;
  blocks: BlueprintBlock[];
  topics: string;
  /** Chet tili imtihonlari uchun tashqi resurslar */
  resources?: StudyResource[];
  isLanguage?: boolean;
}

export interface SubjectCategory {
  key: string;
  title: string;
  emoji: string;
  subjects: SubjectBlueprint[];
}

/** Aniq va tabiiy fanlar: 1–32 MCQ, 33–35 moslashtirish, 36–45 ochiq */
function scienceBlocks(
  mcqInstruction: string,
  matchingInstruction: string,
  writtenInstruction: string,
): BlueprintBlock[] {
  return [
    { style: 'mcq', label: 'Blok 1: Yopiq testlar', from: 1, to: 32, instruction: mcqInstruction },
    {
      style: 'matching',
      label: 'Blok 2: Moslashtirish',
      from: 33,
      to: 35,
      instruction:
        `${matchingInstruction} Har bir moslashtirish savolida 3 ta kichik band (1, 2, 3) va 5 ta variant (A, B, C, D, E) bo'lsin; javob varianti "1-A, 2-C, 3-E" ko'rinishida berilsin.`,
    },
    {
      style: 'written',
      label: 'Blok 3: Ochiq / Yozma savollar',
      from: 36,
      to: 45,
      instruction: `${writtenInstruction} Har bir savol 'a' va 'b' kichik bandlarga ajratilsin.`,
    },
  ];
}

const base = (
  key: string,
  name: string,
  emoji: string,
  topics: string,
  blocks: BlueprintBlock[],
  extra: Partial<SubjectBlueprint> = {},
): SubjectBlueprint => ({
  key,
  name,
  emoji,
  topics,
  blocks,
  durationMinutes: 180,
  totalQuestions: blocks.filter((b) => !b.comingSoon).reduce((n, b) => n + (b.to - b.from + 1), 0),
  ...extra,
});

const LANGUAGE_RESOURCES: StudyResource[] = [
  { label: 'British Council — LearnEnglish', url: 'https://learnenglish.britishcouncil.org/skills' },
  { label: 'Cambridge English — Free practice tests', url: 'https://www.cambridgeenglish.org/learning-english/free-resources/' },
  { label: 'ESL Lounge — CEFR reading passages', url: 'https://www.esl-lounge.com/student/reading.php' },
  { label: 'Google Search — CEFR B2 listening practice', url: 'https://www.google.com/search?q=CEFR+B2+listening+practice+test+pdf' },
  { label: 'Google Search — CEFR C1 reading passages', url: 'https://www.google.com/search?q=CEFR+C1+reading+comprehension+passages+pdf' },
];

export const EXAM_CATEGORIES: SubjectCategory[] = [
  {
    key: 'exact',
    title: 'Aniq va Tabiiy Fanlar',
    emoji: '📐',
    subjects: [
      base('matematika', 'Matematika', '∑',
        'algebra, tenglamalar va tengsizliklar, funksiyalar, progressiyalar, planimetriya, stereometriya, trigonometriya, kombinatorika va ehtimollik',
        scienceBlocks(
          "Barcha matematik ifodalarni LaTeX bilan $...$ ichida yozing. Hisob-kitob va isbot talab qiladigan savollar bo'lsin.",
          'Ikki ustunni (ifoda va natija) moslashtirish. LaTeX ishlating.',
          "Ko'p bosqichli yechim talab qiladigan masalalar. LaTeX ishlating.",
        )),
      base('fizika', 'Fizika', '⚛',
        'mexanika, molekulyar fizika va termodinamika, elektr va magnetizm, optika, atom va yadro fizikasi',
        scienceBlocks(
          "Formulalar va son bilan hisoblanadigan masalalar ustun bo'lsin, birliklar SI da. LaTeX ishlating.",
          "Kattalik–birlik, hodisa–qonun, formula–ma'no juftliklari.",
          'Berilganlar, yechim bosqichlari va javob talab qilinadigan sonli masalalar.',
        )),
      base('kimyo', 'Kimyo', '⚗',
        "atom tuzilishi, davriy sistema, kimyoviy bog'lanish, reaksiya tenglamalari, eritmalar, organik kimyo",
        scienceBlocks(
          "Reaksiya tenglamalari va stexiometrik hisoblashlarga oid savollar bo'lsin.",
          'Modda–sinf, reaksiya–turi, formula–nomi juftliklari.',
          'Hisoblash masalalari: massa ulushi, mol, unum.',
        )),
      base('biologiya', 'Biologiya', '🧬',
        'hujayra biologiyasi, botanika, zoologiya, odam anatomiyasi, genetika va ekologiya',
        scienceBlocks(
          "Tuzilma va funksiya tahliliga oid savollar bo'lsin.",
          'Organ–vazifa, organizm–sistematik guruh, kasallik–sabab juftliklari.',
          'Genetik masalalar va tuzilmaviy tahlil.',
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
        [
          { style: 'reading', label: 'Blok 1: Matn tahlili (Reading)', from: 1, to: 15, instruction: "Qisqa badiiy yoki publitsistik matn asosida tushunishga oid yopiq savollar. Har bir savolda 4 ta variant bo'lsin." },
          { style: 'mcq', label: 'Blok 2: Grammatika', from: 16, to: 30, instruction: 'Fonetika, morfologiya, sintaksis va orfografiyaga oid yopiq testlar.' },
          { style: 'mcq', label: 'Blok 3: Adabiyot', from: 31, to: 42, instruction: 'Adabiy asarlar, mualliflar, janrlar va badiiy tasvir vositalariga oid yopiq testlar.' },
          { style: 'matching', label: 'Blok 4: Moslashtirish', from: 43, to: 45, instruction: "Asar–muallif, atama–ta'rif, so'z–turkum juftliklari. 3 ta kichik band va 5 ta variant, javob \"1-A, 2-C, 3-E\" ko'rinishida." },
          { style: 'essay', label: 'Blok 5: Esse', from: 46, to: 46, instruction: "Bitta esse topshirig'i: mavzu, hajm talabi (200–250 so'z) va baholash mezoni (rubrika) bilan. 'a' bandi — reja, 'b' bandi — esse matni." },
        ]),
      base('tarix', 'Tarix', '🏛',
        "O'zbekiston tarixi va jahon tarixi: qadimgi davr, o'rta asrlar, yangi va eng yangi davr",
        [
          { style: 'mcq', label: 'Blok 1: Yopiq testlar', from: 1, to: 35, instruction: "Sana, voqea, shaxs va davlatlarga oid aniq yopiq savollar, 4 tadan variant bilan." },
          { style: 'matching', label: 'Blok 2: Xronologiya va moslashtirish', from: 36, to: 40, instruction: "Voqealarni xronologik tartibga solish va voqea–sana, shaxs–faoliyat juftliklarini moslashtirish. 3 ta kichik band, 5 ta variant." },
          { style: 'written', label: 'Blok 3: Manba va xarita tahlili', from: 41, to: 45, instruction: "Tarixiy manba parchasi yoki xarita tavsifi berilib, uni tahlil qilish so'ralsin. 'a' va 'b' bandlari bilan." },
        ]),
      base('ingliz_tili', 'Ingliz Tili (CEFR)', '🌐',
        'listening comprehension, reading comprehension, writing, CEFR B1–C1',
        [
          { style: 'listening', label: 'Part 1: Listening (30 ta)', from: 1, to: 30, instruction: "Listening bo'limi: har bir savol uchun qisqa audio-skript (transkript) matn ko'rinishida berilsin, so'ng savol va 4 ta variant. CEFR B1–C1." },
          { style: 'reading', label: 'Part 2: Reading (30 ta)', from: 31, to: 60, instruction: 'Reading passages with comprehension questions, 4 options each. CEFR B1–C1.' },
          { style: 'essay', label: 'Part 3: Writing (2 ta topshiriq)', from: 61, to: 62, instruction: "Two writing tasks (task 1: email/letter ~120 words, task 2: opinion essay ~200 words) with rubric. Parts 'a' and 'b'." },
          { style: 'speaking', label: 'Part 4: Speaking', from: 63, to: 63, instruction: '', comingSoon: true },
        ],
        { isLanguage: true, resources: LANGUAGE_RESOURCES, durationMinutes: 180 }),
      base('geografiya', 'Geografiya', '🗺',
        "tabiiy geografiya, iqtisodiy geografiya, O'zbekiston geografiyasi, xaritashunoslik",
        scienceBlocks(
          "Xarita va mintaqaviy ma'lumotlarga oid savollar bo'lsin.",
          'Davlat–poytaxt, mintaqa–resurs, daryo–havza juftliklari.',
          'Tahliliy qisqa javob talab qiladigan savollar.',
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

/** Generatsiya vaqtida ko'rsatiladigan qiziqarli maslahatlar */
export const GENERATION_TIPS: string[] = [
  'Savollar BMBA rasmiy blueprinti asosida shakllantirilmoqda...',
  "Moslashtirish bo'limi tuzilmoqda — 3 ta band, 5 ta variant...",
  "Muvaffaqiyat kaliti — vaqtni to'g'ri taqsimlash!",
  'Ochiq savollar uchun baholash rubrikasi yozilmoqda...',
  "Rasch modeli har bir savol qiyinligini keyinchalik avtomatik hisoblaydi.",
  "Yopiq testlarda avval ishonchli javoblarni belgilang, keyin qiyinlariga qayting.",
  'LaTeX formulalar tekshirilmoqda...',
  "Har kuni 1 ta mock — 30 kunda katta natija.",
];
