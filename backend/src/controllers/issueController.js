import * as issueService from '../services/issueService.js';

export async function create(req, res) {
  res.status(201).json(await issueService.createIssue(req.body, req.auth.userId, req.file));
}

export async function listMine(req, res) {
  res.json({ issues: await issueService.listMine(req.auth.userId) });
}

export async function categories(req, res) {
  res.json({ categories: await issueService.listCategories() });
}

export async function mapData(req, res) {
  res.json(await issueService.mapCollection());
}

export async function adminList(req, res) {
  const actor = { role: req.auth.role, department: req.auth.user.department };
  res.json({ issues: await issueService.adminList(req.query, actor) });
}