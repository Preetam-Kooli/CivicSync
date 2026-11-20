import { Activity, BarChart3, Camera, FileText, Flame, House, LayoutDashboard, ListChecks, Mail, Map as MapIcon, Megaphone, Settings, Users } from 'lucide-react';

export const isVisible = (item, role) =>
  (!item.superOnly || role === 'super_admin') && (!item.notStaff || role !== 'staff');

const TONE = 'bg-brand-50 text-brand-700';

export const PORTALS = {
  admin: {
    label: 'Admin',
    groups: [
      { group: 'Workspace', items: [
        { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/issues', label: 'Issues', icon: ListChecks, badge: true },
        { to: '/admin/map', label: 'Issue map', icon: MapIcon },
        { to: '/admin/analytics', label: 'Reports', icon: BarChart3 },
        { to: '/admin/hotspots', label: 'Hotspots', icon: Flame },
      ] },
      { group: 'Manage', items: [
        { to: '/admin/alerts', label: 'Alerts', icon: Megaphone, notStaff: true },
        { to: '/admin/users', label: 'Users', icon: Users, superOnly: true },
        { to: '/admin/invites', label: 'Invitations', icon: Mail, superOnly: true },
      ] },
      { group: 'Account', items: [{ to: '/admin/settings', label: 'Settings', icon: Settings }] },
    ],
    tabs: {
      left: [{ to: '/admin', label: 'Home', icon: House, end: true }, { to: '/admin/issues', label: 'Issues', icon: ListChecks }],
      right: [{ to: '/admin/map', label: 'Map', icon: MapIcon }],
    },
    more: [
      { to: '/admin/analytics', label: 'Reports', icon: BarChart3, tone: TONE },
      { to: '/admin/hotspots', label: 'Hotspots', icon: Flame, tone: 'bg-orange-50 text-orange-700' },
      { to: '/admin/alerts', label: 'Alerts', icon: Megaphone, tone: 'bg-red-50 text-red-700', notStaff: true },
      { to: '/admin/users', label: 'Users', icon: Users, tone: 'bg-sky-50 text-sky-700', superOnly: true },
      { to: '/admin/invites', label: 'Invitations', icon: Mail, tone: 'bg-violet-50 text-violet-700', superOnly: true },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
    create: [
      { to: '/admin/issues?status=reported', label: 'Review new reports', icon: ListChecks },
      { to: '/admin/invites', label: 'Invite staff or admin', icon: Mail, superOnly: true },
      { to: '/admin/alerts', label: 'Send announcement', icon: Megaphone, notStaff: true },
    ],
  },
  citizen: {
    label: 'Citizen',
    groups: [
      { group: 'Workspace', items: [
        { to: '/citizen', label: 'Home', icon: House, end: true },
        { to: '/citizen/report', label: 'Report an issue', icon: Camera },
        { to: '/citizen/reports', label: 'My reports', icon: ListChecks },
        { to: '/citizen/map', label: 'Map', icon: MapIcon },
      ] },
      { group: 'Public', items: [
        { to: '/transparency', label: 'Transparency', icon: Activity },
        { to: '/open-data', label: 'Open data', icon: FileText },
      ] },
      { group: 'Account', items: [{ to: '/citizen/settings', label: 'Settings', icon: Settings }] },
    ],
    tabs: {
      left: [{ to: '/citizen', label: 'Home', icon: House, end: true }, { to: '/citizen/reports', label: 'My reports', icon: ListChecks }],
      right: [{ to: '/citizen/map', label: 'Map', icon: MapIcon }],
    },
    more: [
      { to: '/transparency', label: 'Transparency', icon: Activity, tone: TONE },
      { to: '/open-data', label: 'Open data', icon: FileText, tone: 'bg-sky-50 text-sky-700' },
      { to: '/citizen/settings', label: 'Settings', icon: Settings },
    ],
    create: [],
  },
};