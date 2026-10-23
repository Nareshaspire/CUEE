import type { Access, CollectionConfig } from 'payload'

const isAdmin = ({ req }: Parameters<Access>[0]) => req.user?.collection === 'admins'
const isSelfOrAdmin: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    hidden: true,
    useAsTitle: 'email',
  },
  access: {
    create: () => true,
    delete: isSelfOrAdmin,
    read: isSelfOrAdmin,
    update: isSelfOrAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'accountType',
      type: 'select',
      required: true,
      defaultValue: 'baker',
      access: {
        create: () => true,
        update: ({ req }) => req.user?.collection === 'admins',
      },
      options: [
        { label: 'Baker', value: 'baker' },
        { label: 'Isolated demo', value: 'demo' },
      ],
    },
  ],
}
