export const DEPARTMENTS = [
  { value: 'public_service', label: 'Public services' },
  { value: 'streetlight', label: 'Streetlights' },
  { value: 'flood', label: 'Flood and waterlogging' },
  { value: 'road', label: 'Road safety' },
  { value: 'fire', label: 'Fire emergency' },
];

export const ROLE_LABELS = {
  citizen: 'Citizen',
  volunteer: 'Volunteer',
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export const deptLabel = (value) => DEPARTMENTS.find((d) => d.value === value)?.label ?? '—';