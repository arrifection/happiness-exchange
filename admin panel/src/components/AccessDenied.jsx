import React from 'react';

/**
 * AccessDenied – friendly card displayed when a user lacks the required role.
 */
export default function AccessDenied({ requiredRole }) {
  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-surface-100 mb-2">Access Restricted</h1>
        <p className="text-surface-400 text-sm mb-6">
          Your account does not have permission to view this page.
          {requiredRole && (
            <> Required role: <span className="text-brand-400 font-mono">{requiredRole}</span></>
          )}
        </p>
        <button className="btn-secondary" onClick={() => window.history.back()}>Go Back</button>
      </div>
    </div>
  );
}
