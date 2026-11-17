import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import IssueMap from './IssueMap.jsx';

export default function IssueMapPage({ detailPath }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/api/shared/map')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Issue map</h1>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-slate-500">Loading map…</p>}
      {data && (
        <IssueMap
          collection={data}
          onOpenIssue={detailPath ? (id) => navigate(detailPath(id)) : undefined}
        />
      )}
    </div>
  );
}