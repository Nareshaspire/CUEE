import type { Access, CollectionConfig } from 'payload'

const signedIn: Access = ({ req }) =>
  req.user?.collection === 'users' || req.user?.collection === 'admins'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    group: 'CUE workflows',
    useAsTitle: 'name',
  },
  access: {
    create: ({ req }) => req.user?.collection === 'admins',
    delete: ({ req }) => req.user?.collection === 'admins',
    read: signedIn,
    update: ({ req }) => req.user?.collection === 'admins',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'taskDefinitions',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'sequence', type: 'number', required: true, min: 1 },
        {
          name: 'category',
          type: 'select',
          required: true,
          options: [
            'preparation',
            'active',
            'waiting',
            'inspection',
            'finishing',
            'packing',
            'storage',
          ],
        },
        {
          name: 'prerequisites',
          type: 'array',
          fields: [{ name: 'taskKey', type: 'text', required: true }],
        },
        { name: 'allowsParallel', type: 'checkbox', defaultValue: false },
        {
          name: 'waitingReason',
          type: 'select',
          options: ['cooling', 'freezing', 'chilling', 'setting'],
        },
        { name: 'expectedMinutes', type: 'number', min: 1 },
        { name: 'physicalCheckRequired', type: 'checkbox', defaultValue: false },
        { name: 'completionCriteria', type: 'textarea' },
        { name: 'mandatory', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}
