import type { Access, CollectionConfig } from 'payload'

const owned: Access = ({ req }) => {
  if (req.user?.collection === 'admins') return true
  if (req.user?.collection !== 'users') return false
  return { owner: { equals: req.user.id } }
}

export const PendingActions: CollectionConfig = {
  slug: 'pending-actions',
  admin: {
    group: 'CUE workflows',
    useAsTitle: 'taskKey',
  },
  access: {
    create: ({ data, req }) =>
      req.user?.collection === 'admins' ||
      (req.user?.collection === 'users' && data?.owner === req.user.id),
    delete: owned,
    read: owned,
    update: owned,
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'productionRun',
      type: 'relationship',
      relationTo: 'production-runs',
      required: true,
      index: true,
    },
    { name: 'taskKey', type: 'text', required: true },
    { name: 'expectedState', type: 'text', required: true },
    { name: 'proposedState', type: 'text', required: true },
    {
      name: 'actionType',
      type: 'select',
      required: true,
      options: ['transition', 'correction', 'inspection'],
    },
    { name: 'reason', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      options: ['PENDING', 'CONFIRMED', 'CANCELLED', 'STALE'],
    },
    { name: 'snapshotVersion', type: 'number', required: true },
    { name: 'expiresAt', type: 'date' },
  ],
}
