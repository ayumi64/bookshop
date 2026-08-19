/**
 * Seed script — inserts public-domain sample books + chapters so the MVP can be
 * verified end to end (PRD Q2: 公版/公有领域作品验证闭环; 版权采购是业务侧决策).
 *
 * Usage:
 *   填写 .env.local 后：npm run supabase:seed
 *
 * Books use public-domain classic works. Content below is short illustrative
 * excerpts (real full text would be supplied by the owner at publish time).
 */
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const scope = createClient(url, key, { auth: { persistSession: false } });

const BOOKS = [
  {
    slug: 'alice-in-wonderland',
    title: 'Alice\u2019s Adventures in Wonderland',
    author: 'Lewis Carroll',
    category: 'Classic',
    price_cents: 299,
    currency: 'usd',
    trial_chapters: 2,
    trial_percent: 10,
    status: 'published',
    blurb:
      'A little girl falls down a rabbit hole into a fantastical world. This is a sample seed of a public-domain classic used to verify the buy-and-read loop.',
  },
  {
    slug: 'the-adventures-of-sherlock-holmes',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    category: 'Mystery',
    price_cents: 499,
    currency: 'usd',
    trial_chapters: 2,
    trial_percent: 10,
    status: 'published',
    blurb:
      'Twelve short stories of the world\u2019s greatest detective, from a public-domain classic collection.',
  },
  {
    slug: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    category: 'Romance',
    price_cents: 399,
    currency: 'usd',
    trial_chapters: 2,
    trial_percent: 10,
    status: 'published',
    blurb:
      'A witty portrait of manners, marriage, and money among the gentry — a beloved public-domain novel.',
  },
  {
    slug: 'the-time-machine',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    category: 'Science Fiction',
    price_cents: 349,
    currency: 'usd',
    trial_chapters: 2,
    trial_percent: 10,
    status: 'published',
    blurb:
      'A scientist voyages far into the future. A classic Victorian science-fiction seed title.',
  },
  {
    slug: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    category: 'Horror',
    price_cents: 299,
    currency: 'usd',
    trial_chapters: 2,
    trial_percent: 10,
    status: 'published',
    blurb:
      'The modern Prometheus — a foundational gothic novel, in the public domain.',
  },
];

const chapterTemplate = (title: string, n: number) => ({
  title,
  content: [
    `# ${title}`,
    '',
    `这是第 ${n} 章的开头。为验证「试读 + 解锁购买 + 阅读进度」闭环，本段作为种子示例内容。`,
    '若本书已购买，你将看到全部章节；未购买时，只有位于试读窗口内的章节对游客可见。',
    '',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Cras mattis consectetur purus sit amet fermentum.',
    '',
    'Donec id elit non mi porta gravida at eget metus. Maecenas faucibus mollis interdum. ', // paragraph anchor examples
    '',
    'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. (全文示例)',
  ].join('\n'),
});

async function main() {
  for (const book of BOOKS) {
    const { data: existing } = await scope
      .from('books')
      .select('id')
      .eq('slug', book.slug)
      .maybeSingle();
    if (existing) {
      console.log('skip (exists):', book.slug);
      continue;
    }
    const { data: created, error } = await scope.from('books').insert({
      ...book,
      body_location: `book-content/${book.slug}`,
      cover_url: null, // point to a Storage object after uploading a cover file
    }).select('*').single();
    if (error) {
      console.error('book error', book.slug, error.message);
      continue;
    }
    const chapters = Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      return {
        book_id: created.id,
        slug: `chapter-${n}`,
        title: `第 ${n} 章`,
        sort_order: n,
        is_trial: false,
        content: chapterTemplate(`第 ${n} 章`, n).content,
      };
    });
    const { error: chErr } = await scope.from('chapters').insert(chapters);
    if (chErr) {
      console.error('chapters error', book.slug, chErr.message);
    } else {
      console.log('seeded', book.slug, '(', chapters.length, 'chapters )');
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
