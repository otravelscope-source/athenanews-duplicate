import { defineType, defineField, defineArrayMember } from 'sanity';

const imageFields = [
  defineField({ name: 'alt', type: 'string', validation: R => R.required() }),
  defineField({ name: 'caption', type: 'text', rows: 2 }),
  defineField({ name: 'credit', type: 'string', validation: R => R.required() }),
  defineField({ name: 'sourceUrl', type: 'url' }),
  defineField({ name: 'externalUrl', title: 'External image URL', type: 'url', description: 'Optional Wikimedia image address when not uploading a file. Confirm the publication licence and complete the caption, credit and source fields.', validation: R => R.custom(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org' && !url.username && !url.password && !url.search && !url.hash && /\.(jpe?g|png|webp)$/i.test(url.pathname)
        ? true : 'Use a direct HTTPS image from upload.wikimedia.org, without query parameters.';
    } catch { return 'Enter a valid image URL.'; }
  }) }),
  defineField({ name: 'legacyCredit', type: 'text', readOnly: true }),
  defineField({ name: 'originalUrl', title: 'Preserved external image', type: 'url', readOnly: true, description: 'Existing external photograph. Upload a replacement to host it in this newsroom.' }),
];
const author = defineType({
  name: 'author', title: 'Authors', type: 'document', fields: [
    defineField({ name: 'name', type: 'string', validation: R => R.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name' }, validation: R => R.required() }),
    defineField({ name: 'bio', type: 'text' }),
    defineField({ name: 'photo', type: 'image', options: { hotspot: true }, fields: imageFields }),
  ],
});
const category = defineType({
  name: 'category', title: 'Categories', type: 'document', fields: [
    defineField({ name: 'title', type: 'string', validation: R => R.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title' }, validation: R => R.required() }),
  ],
});
const article = defineType({
  name: 'article', title: 'Articles', type: 'document', fields: [
    defineField({ name: 'title', type: 'string', validation: R => R.required() }),
    defineField({ name: 'subtitle', type: 'text', rows: 3 }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title', maxLength: 180 }, validation: R => R.required() }),
    defineField({ name: 'legacyId', type: 'string', readOnly: true, description: 'Preserves the existing article URL and reader-history mapping.' }),
    defineField({ name: 'authors', type: 'array', of: [{ type: 'reference', to: [{ type: 'author' }] }], validation: R => R.required().min(1) }),
    defineField({ name: 'category', type: 'reference', to: [{ type: 'category' }], validation: R => R.required() }),
    defineField({ name: 'publishedAt', title: 'Original publication date', type: 'datetime', validation: R => R.required() }),
    defineField({ name: 'updatedAt', title: 'Last editorial update', type: 'datetime' }),
    defineField({ name: 'breaking', title: 'Breaking news', type: 'boolean', initialValue: false }),
    defineField({ name: 'mainImage', type: 'image', options: { hotspot: true }, fields: imageFields, validation: R => R.custom(value => !value || value.asset?._ref || value.externalUrl || value.originalUrl ? true : 'Upload an image or provide an external image URL.') }),
    defineField({ name: 'body', type: 'array', description: 'Use attribution within news prose. Keep URLs, citations and reference lists out of the article. Image licence addresses belong in image metadata.', of: [
      defineArrayMember({ type: 'block', styles: [{ title: 'Normal', value: 'normal' }, { title: 'Heading', value: 'h2' }],
        marks: { decorators: [{ title: 'Strong', value: 'strong' }, { title: 'Emphasis', value: 'em' }], annotations: [] }
      }),
      defineArrayMember({ type: 'image', options: { hotspot: true }, fields: imageFields }),
    ], validation: R => R.required().min(1) }),
    defineField({ name: 'legacyRevision', type: 'number', readOnly: true }),
  ],
  orderings: [{ title: 'Publication date', name: 'publishedAtDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
});
export const schemaTypes = [author, category, article];
