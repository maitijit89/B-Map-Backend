/**
 * Generates the self-contained, high-performance HTML/CSS/JS Admin Web Portal for B-Map.
 */
export const getAdminDashboardHtml = (apiPrefix: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B-Map Sovereign Navigation — Admin Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #0a0e17;
      --bg-card: rgba(18, 25, 38, 0.75);
      --bg-card-hover: rgba(26, 36, 54, 0.9);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(56, 189, 248, 0.3);
      --primary: #38bdf8;
      --primary-glow: rgba(56, 189, 248, 0.25);
      --secondary: #818cf8;
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.15);
      --warning: #f59e0b;
      --warning-bg: rgba(245, 158, 11, 0.15);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.15);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: radial-gradient(circle at 15% 15%, #131c2e 0%, var(--bg-dark) 85%);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }

    /* Top Navigation Bar */
    header {
      background: rgba(10, 14, 23, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 0.85rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px var(--primary-glow);
    }

    .brand-title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-subtitle {
      font-size: 0.72rem;
      color: var(--text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .token-input-group {
      display: flex;
      align-items: center;
      background: rgba(18, 25, 38, 0.8);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.25rem 0.5rem;
      gap: 0.5rem;
    }

    .token-input-group input {
      background: transparent;
      border: none;
      color: var(--text-main);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      width: 220px;
      outline: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      text-decoration: none;
      white-space: nowrap;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .btn-primary:hover {
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.5);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--border-subtle);
      color: var(--text-main);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-danger {
      background: var(--danger-bg);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fca5a5;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.3);
    }

    .btn-sm {
      padding: 0.3rem 0.65rem;
      font-size: 0.75rem;
    }

    /* Sub-header Navigation Tabs */
    .tabs-bar {
      background: rgba(14, 20, 31, 0.6);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.35rem 2rem;
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs-bar::-webkit-scrollbar {
      display: none;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.55rem 0.95rem;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .tab-btn:hover {
      color: var(--text-main);
      background: rgba(255, 255, 255, 0.04);
    }

    .tab-btn.active {
      color: var(--primary);
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
    }

    /* Main Container */
    main {
      padding: 2rem;
      flex: 1;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }

    .tab-pane {
      display: none;
      animation: fadeIn 0.2s ease-in-out;
    }
    .tab-pane.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Metric Grid Cards */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1.35rem;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      transition: all 0.2s ease;
    }

    .card:hover {
      border-color: rgba(255, 255, 255, 0.15);
      background: var(--bg-card-hover);
    }

    .card-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.65rem;
    }

    .card-val {
      font-size: 1.9rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .card-hint {
      font-size: 0.74rem;
      color: var(--text-dim);
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-success { background: var(--success-bg); color: #34d399; }
    .badge-warning { background: var(--warning-bg); color: #fbbf24; }
    .badge-danger { background: var(--danger-bg); color: #f87171; }
    .badge-primary { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }

    /* Tables */
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      overflow: hidden;
      margin-bottom: 2rem;
    }

    .table-header-bar {
      padding: 1rem 1.35rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .table-title {
      font-size: 1.05rem;
      font-weight: 700;
    }

    .table-tools {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .search-input {
      background: rgba(10, 14, 23, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: #fff;
      padding: 0.45rem 0.85rem;
      font-size: 0.8rem;
      outline: none;
      width: 240px;
    }
    .search-input:focus {
      border-color: var(--primary);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.83rem;
    }

    th {
      background: rgba(14, 20, 31, 0.7);
      padding: 0.75rem 1.25rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .empty-state {
      padding: 3rem;
      text-align: center;
      color: var(--text-dim);
      font-size: 0.9rem;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 1rem;
    }
    .modal-backdrop.open {
      display: flex;
    }

    .modal-window {
      background: #111827;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      max-width: 550px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .modal-head {
      padding: 1.2rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .modal-foot {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-subtle);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    .form-control {
      background: rgba(10, 14, 23, 0.8);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      color: #fff;
      padding: 0.55rem 0.8rem;
      font-size: 0.83rem;
      outline: none;
    }
    .form-control:focus {
      border-color: var(--primary);
    }

    /* Toast Notification */
    .toast-container {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 999;
    }

    .toast {
      background: #1e293b;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.75rem 1.25rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.82rem;
      color: #fff;
      animation: slideIn 0.25s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .code-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.73rem;
      background: rgba(0, 0, 0, 0.4);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      color: #7dd3fc;
    }

    /* Grid layout for system health */
    .health-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.25rem;
    }
  </style>
</head>
<body>

  <!-- Top Navigation Header -->
  <header>
    <div class="brand">
      <div class="brand-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
          <line x1="9" y1="3" x2="9" y2="18"></line>
          <line x1="15" y1="6" x2="15" y2="21"></line>
        </svg>
      </div>
      <div>
        <div class="brand-title">B-Map Admin Console</div>
        <div class="brand-subtitle">Indian Sovereign Geospatial & Navigation Engine</div>
      </div>
    </div>

    <div class="header-actions">
      <div class="token-input-group" title="Administrator JWT Access Token">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2">
          <circle cx="8" cy="15" r="4"></circle>
          <path d="M10.85 12.15L19 4"></path>
          <path d="M18 5l2 2"></path>
          <path d="M15 8l2 2"></path>
        </svg>
        <input type="password" id="adminTokenInput" placeholder="Bearer JWT Token..." />
        <button class="btn btn-secondary btn-sm" onclick="saveAdminToken()">Save</button>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="fetchOverviewMetrics()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        Refresh
      </button>
      <button class="btn btn-primary btn-sm" onclick="triggerCacheFlush('routes')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        Flush Route Cache
      </button>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <nav class="tabs-bar">
    <button class="tab-btn active" onclick="switchTab('overview')">📊 Overview & Metrics</button>
    <button class="tab-btn" onclick="switchTab('users')">👥 User Directory</button>
    <button class="tab-btn" onclick="switchTab('traffic')">🚦 Traffic & Incidents</button>
    <button class="tab-btn" onclick="switchTab('weather')">🌦️ Weather & Fog Advisories</button>
    <button class="tab-btn" onclick="switchTab('hazards')">⚠️ Road Hazards</button>
    <button class="tab-btn" onclick="switchTab('tolls')">🏷️ Toll Plazas & FASTag</button>
    <button class="tab-btn" onclick="switchTab('places')">📍 Master POIs</button>
    <button class="tab-btn" onclick="switchTab('sos')">🚨 SOS Dispatch</button>
    <button class="tab-btn" onclick="switchTab('system')">⚡ System Health & Cache</button>
    <button class="tab-btn" onclick="switchTab('config')">⚙️ Feature Flags</button>
    <button class="tab-btn" onclick="switchTab('audit')">📜 Audit Trail</button>
  </nav>

  <!-- Main Content Areas -->
  <main>
    <!-- TAB 1: OVERVIEW -->
    <div id="tab-overview" class="tab-pane active">
      <div class="metrics-grid">
        <div class="card">
          <div class="card-label">
            <span>Total Registered Users</span>
            <span class="badge badge-primary">Database</span>
          </div>
          <div class="card-val" id="metric-total-users">--</div>
          <div class="card-hint">
            <span id="metric-verified-users">--</span> email verified accounts
          </div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Estimated Active Users</span>
            <span class="badge badge-success">Live</span>
          </div>
          <div class="card-val" id="metric-active-users">--</div>
          <div class="card-hint">Active sessions in the last 24 hours</div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Customer Rating</span>
            <span class="badge badge-warning">Score</span>
          </div>
          <div class="card-val" id="metric-average-rating">--</div>
          <div class="card-hint"><span id="metric-total-ratings">--</span> ratings collected</div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Active Road Advisories</span>
            <span class="badge badge-danger">Overrides</span>
          </div>
          <div class="card-val" id="metric-active-alerts">--</div>
          <div class="card-hint">
            <span id="metric-traffic-count">--</span> Traffic, <span id="metric-fog-count">--</span> Fog Alerts
          </div>
        </div>
      </div>

      <!-- Feature Usage & Top Stats -->
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">🚀 Core Sovereign Navigation Capabilities Usage</div>
          <div class="code-pill">Telemetric Data Engine</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Feature Domain</th>
              <th>Total Invocations</th>
              <th>Traffic Proportion</th>
              <th>Operational Status</th>
            </tr>
          </thead>
          <tbody id="feature-usage-table-body">
            <tr><td colspan="4" class="empty-state">Loading feature analytics...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: USERS -->
    <div id="tab-users" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">👥 User Directory & Role Assignment</div>
          <div class="table-tools">
            <input type="text" id="userSearchInput" class="search-input" placeholder="Search by name, email, phone..." oninput="handleUserSearch()" />
            <button class="btn btn-primary btn-sm" onclick="openCreateUserModal()">+ Create User</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>User Details</th>
              <th>Phone Number</th>
              <th>Age</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Registered At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="users-table-body">
            <tr><td colspan="7" class="empty-state">Loading users directory...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 3: TRAFFIC -->
    <div id="tab-traffic" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">🚦 Active Traffic Congestion & Slowdown Overrides</div>
          <button class="btn btn-primary btn-sm" onclick="openTrafficModal()">+ Inject Traffic Override</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Segment ID</th>
              <th>Highway / Corridor</th>
              <th>Congestion</th>
              <th>Speed Factor</th>
              <th>Description</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="traffic-table-body">
            <tr><td colspan="7" class="empty-state">Loading traffic overrides...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 4: WEATHER -->
    <div id="tab-weather" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">🌦️ Highway Weather & IMD Fog Advisories</div>
          <button class="btn btn-primary btn-sm" onclick="openWeatherModal()">+ Set Weather Advisory</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Expressway Name</th>
              <th>Visibility</th>
              <th>Dense Fog</th>
              <th>IMD Alert</th>
              <th>Advisory Note</th>
              <th>Updated At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="weather-table-body">
            <tr><td colspan="7" class="empty-state">Loading weather advisories...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 5: ROAD HAZARDS -->
    <div id="tab-hazards" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">⚠️ Crowdsourced & Official Road Hazards</div>
          <button class="btn btn-primary btn-sm" onclick="openHazardModal()">+ Broadcast Hazard</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Hazard ID</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Location (Lat, Lng)</th>
              <th>Confirmations</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="hazards-table-body">
            <tr><td colspan="7" class="empty-state">Loading road hazards...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 6: TOLLS -->
    <div id="tab-tolls" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">🏷️ National Highway Toll Plazas & FASTag Registry</div>
          <button class="btn btn-primary btn-sm" onclick="openTollModal()">+ Add Toll Plaza</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Plaza Name</th>
              <th>Highway Corridor</th>
              <th>Single Trip</th>
              <th>Return Trip</th>
              <th>Monthly Pass</th>
              <th>FASTag Status</th>
              <th>Operator</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tolls-table-body">
            <tr><td colspan="8" class="empty-state">Loading toll plazas...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 7: PLACES / POIs -->
    <div id="tab-places" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">📍 Master Points of Interest (POIs)</div>
          <button class="btn btn-primary btn-sm" onclick="openPlaceModal()">+ Create POI</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>POI Name</th>
              <th>Category</th>
              <th>Coordinates [Lon, Lat]</th>
              <th>Rating</th>
              <th>Tags</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="places-table-body">
            <tr><td colspan="7" class="empty-state">Loading POIs...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 8: SOS DISPATCH -->
    <div id="tab-sos" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">🚨 Highway Emergency SOS Dispatch Console</div>
          <div class="code-pill">112 / 1033 NHAI Integrated</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Incident ID</th>
              <th>Emergency Type</th>
              <th>Vehicle Number</th>
              <th>User Phone</th>
              <th>Dispatch Status</th>
              <th>Location</th>
              <th>Reported At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="sos-table-body">
            <tr><td colspan="8" class="empty-state">Loading emergency incidents...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 9: SYSTEM HEALTH & CACHE -->
    <div id="tab-system" class="tab-pane">
      <div class="health-grid">
        <div class="card">
          <div class="card-label">
            <span>MongoDB Geospatial DB</span>
            <span id="health-db-status" class="badge">--</span>
          </div>
          <div class="card-val" id="health-db-ping">-- ms</div>
          <div class="card-hint">Host: <span id="health-db-host" class="code-pill">--</span></div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Redis Cache & Geo Index</span>
            <span id="health-redis-status" class="badge">--</span>
          </div>
          <div class="card-val" id="health-redis-keys">-- keys</div>
          <div class="card-hint">Route keys: <span id="health-route-keys">--</span></div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>OSRM Routing Engine</span>
            <span id="health-osrm-status" class="badge">--</span>
          </div>
          <div class="card-val" id="health-osrm-ping">-- ms</div>
          <div class="card-hint"><span id="health-osrm-url" class="code-pill">--</span></div>
        </div>

        <div class="card">
          <div class="card-label">
            <span>Server Process Uptime</span>
            <span class="badge badge-primary">Node.js</span>
          </div>
          <div class="card-val" id="health-uptime">--</div>
          <div class="card-hint">Heap used: <span id="health-heap">--</span> MB</div>
        </div>
      </div>
    </div>

    <!-- TAB 10: CONFIG & FEATURE FLAGS -->
    <div id="tab-config" class="tab-pane">
      <div class="card" style="max-width: 750px; margin: 0 auto;">
        <h3 style="margin-bottom: 1.25rem;">⚙️ Sovereign Feature Flags & Navigation Parameters</h3>
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600;">Maintenance Mode</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Displays maintenance barrier to non-admin requests</div>
            </div>
            <input type="checkbox" id="cfg-maintenance-mode" style="width: 20px; height: 20px;">
          </label>

          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600;">NavIC Satellite GNSS Enhancement</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Enables ISRO sovereign L5/S-band sub-meter positioning</div>
            </div>
            <input type="checkbox" id="cfg-navic" checked style="width: 20px; height: 20px;">
          </label>

          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600;">AI Driving Copilot</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Enables multi-turn voice and contextual assistance</div>
            </div>
            <input type="checkbox" id="cfg-copilot" checked style="width: 20px; height: 20px;">
          </label>

          <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
            <div>
              <div style="font-weight: 600;">Lane-Level HD Guidance</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">Computes sub-lane turn manoeuvres for highway exits</div>
            </div>
            <input type="checkbox" id="cfg-lane" checked style="width: 20px; height: 20px;">
          </label>

          <div class="form-group">
            <label>Off-Route Threshold (Meters)</label>
            <input type="number" id="cfg-off-route" class="form-control" value="40">
          </div>

          <div class="form-group">
            <label>Reroute Cooldown (Seconds)</label>
            <input type="number" id="cfg-reroute-cooldown" class="form-control" value="5">
          </div>

          <button class="btn btn-primary" onclick="saveSystemConfig()">Save Dynamic Configuration</button>
        </div>
      </div>
    </div>

    <!-- TAB 11: AUDIT TRAIL -->
    <div id="tab-audit" class="tab-pane">
      <div class="table-container">
        <div class="table-header-bar">
          <div class="table-title">📜 Administrative Audit Trail & Compliance Log</div>
          <button class="btn btn-secondary btn-sm" onclick="fetchAuditLogs()">Refresh Logs</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin Actor</th>
              <th>Action Executed</th>
              <th>Target Resource</th>
              <th>Client IP</th>
            </tr>
          </thead>
          <tbody id="audit-table-body">
            <tr><td colspan="5" class="empty-state">Loading audit logs...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- Modals -->
  <!-- Create User Modal -->
  <div id="modal-create-user" class="modal-backdrop">
    <div class="modal-window">
      <div class="modal-head">
        <h4>Create System User</h4>
        <button class="btn btn-secondary btn-sm" onclick="closeModal('modal-create-user')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="new-user-name" class="form-control" placeholder="e.g. Rahul Sharma" required />
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="new-user-email" class="form-control" placeholder="rahul@example.com" required />
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input type="text" id="new-user-phone" class="form-control" placeholder="+91 9811223344" required />
        </div>
        <div class="form-group">
          <label>Age</label>
          <input type="number" id="new-user-age" class="form-control" value="28" required />
        </div>
        <div class="form-group">
          <label>Role</label>
          <select id="new-user-role" class="form-control">
            <option value="user">Standard User</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal('modal-create-user')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCreateUser()">Create User</button>
      </div>
    </div>
  </div>

  <!-- Traffic Modal -->
  <div id="modal-traffic" class="modal-backdrop">
    <div class="modal-window">
      <div class="modal-head">
        <h4>Inject Traffic Congestion Override</h4>
        <button class="btn btn-secondary btn-sm" onclick="closeModal('modal-traffic')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Segment / Corridor Identifier</label>
          <input type="text" id="tf-segment-id" class="form-control" placeholder="e.g. NH48_GGN_01" />
        </div>
        <div class="form-group">
          <label>Highway / Road Name</label>
          <input type="text" id="tf-road-name" class="form-control" placeholder="e.g. NH-48 Cyber City Flyover" />
        </div>
        <div class="form-group">
          <label>Congestion Level</label>
          <select id="tf-congestion" class="form-control">
            <option value="YELLOW">YELLOW (Moderate Congestion)</option>
            <option value="RED">RED (Heavy Traffic)</option>
            <option value="DARK_RED" selected>DARK_RED (Standstill / Blocked)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Speed Factor (0.1 to 1.0)</label>
          <input type="number" step="0.05" id="tf-speed-factor" class="form-control" value="0.25" />
        </div>
        <div class="form-group">
          <label>Incident Description</label>
          <textarea id="tf-desc" class="form-control" rows="2" placeholder="e.g. Broken down truck occupying middle lane"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal('modal-traffic')">Cancel</button>
        <button class="btn btn-primary" onclick="submitTrafficOverride()">Save Override</button>
      </div>
    </div>
  </div>

  <!-- Weather Modal -->
  <div id="modal-weather" class="modal-backdrop">
    <div class="modal-window">
      <div class="modal-head">
        <h4>Broadcast Highway Weather Advisory</h4>
        <button class="btn btn-secondary btn-sm" onclick="closeModal('modal-weather')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Expressway Name</label>
          <input type="text" id="wt-highway" class="form-control" value="Yamuna Expressway" />
        </div>
        <div class="form-group">
          <label>Visibility (Meters)</label>
          <input type="number" id="wt-vis" class="form-control" value="40" />
        </div>
        <div class="form-group">
          <label>Dense Fog Active</label>
          <select id="wt-fog" class="form-control">
            <option value="true" selected>YES (Zero/Dense Fog)</option>
            <option value="false">NO (Clear)</option>
          </select>
        </div>
        <div class="form-group">
          <label>IMD Alert Level</label>
          <select id="wt-alert" class="form-control">
            <option value="GREEN">GREEN (No Warning)</option>
            <option value="YELLOW">YELLOW (Watch)</option>
            <option value="ORANGE" selected>ORANGE (Be Prepared)</option>
            <option value="RED">RED (Take Action)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Safety Advisory Voice & HUD Note</label>
          <textarea id="wt-advisory" class="form-control" rows="2">Extreme winter fog on Yamuna Expressway. Maximum speed 50 km/h with fog lights ON.</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" onclick="closeModal('modal-weather')">Cancel</button>
        <button class="btn btn-primary" onclick="submitWeatherOverride()">Broadcast Advisory</button>
      </div>
    </div>
  </div>

  <!-- Toast Container -->
  <div id="toast-box" class="toast-container"></div>

  <script>
    const API_BASE = '${apiPrefix}/admin';

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getAuthToken() {
      return localStorage.getItem('bmap_admin_jwt') || document.getElementById('adminTokenInput').value.trim();
    }

    function saveAdminToken() {
      const val = document.getElementById('adminTokenInput').value.trim();
      if (val) {
        localStorage.setItem('bmap_admin_jwt', val);
        showToast('🔑 Admin token securely stored in browser');
        refreshActiveTab();
      } else {
        localStorage.removeItem('bmap_admin_jwt');
        showToast('Token cleared');
      }
    }

    async function apiRequest(endpoint, method = 'GET', body = null) {
      const token = getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);

      try {
        const res = await fetch(API_BASE + endpoint, opts);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || ('HTTP ' + res.status));
        }
        return json.data || json;
      } catch (err) {
        showToast('❌ ' + err.message, true);
        throw err;
      }
    }

    function showToast(msg, isError = false) {
      const box = document.getElementById('toast-box');
      const div = document.createElement('div');
      div.className = 'toast';
      if (isError) div.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      div.innerHTML = msg;
      box.appendChild(div);
      setTimeout(() => div.remove(), 4000);
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabId));
      if (activeBtn) activeBtn.classList.add('active');
      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');
      refreshTabContent(tabId);
    }

    function refreshActiveTab() {
      const active = document.querySelector('.tab-pane.active');
      if (active) {
        const tabId = active.id.replace('tab-', '');
        refreshTabContent(tabId);
      }
    }

    function refreshTabContent(tabId) {
      if (tabId === 'overview') fetchOverviewMetrics();
      else if (tabId === 'users') fetchUsersList();
      else if (tabId === 'traffic') fetchTrafficOverrides();
      else if (tabId === 'weather') fetchWeatherOverrides();
      else if (tabId === 'hazards') fetchRoadHazards();
      else if (tabId === 'tolls') fetchTollsList();
      else if (tabId === 'places') fetchPlacesList();
      else if (tabId === 'sos') fetchSOSIncidents();
      else if (tabId === 'system') fetchSystemHealth();
      else if (tabId === 'config') fetchSystemConfig();
      else if (tabId === 'audit') fetchAuditLogs();
    }

    // Modal helpers
    function openModal(id) { document.getElementById(id).classList.add('open'); }
    function closeModal(id) { document.getElementById(id).classList.remove('open'); }
    function openCreateUserModal() { openModal('modal-create-user'); }
    function openTrafficModal() { openModal('modal-traffic'); }
    function openWeatherModal() { openModal('modal-weather'); }

    // TAB 1: OVERVIEW
    async function fetchOverviewMetrics() {
      try {
        const data = await apiRequest('/overview');
        document.getElementById('metric-total-users').innerText = data.total_users ?? 0;
        document.getElementById('metric-verified-users').innerText = data.verified_users_count ?? 0;
        document.getElementById('metric-active-users').innerText = data.active_users_count ?? 0;
        document.getElementById('metric-average-rating').innerText = (data.average_rating ?? 5.0) + ' / 5.0';
        document.getElementById('metric-total-ratings').innerText = data.total_ratings_count ?? 0;
        document.getElementById('metric-active-alerts').innerText = (data.active_traffic_overrides_count || 0) + (data.active_weather_overrides_count || 0);
        document.getElementById('metric-traffic-count').innerText = data.active_traffic_overrides_count || 0;
        document.getElementById('metric-fog-count').innerText = data.active_weather_overrides_count || 0;

        fetchFeatureUsage();
      } catch (e) {}
    }

    async function fetchFeatureUsage() {
      try {
        const list = await apiRequest('/analytics/feature-usage');
        const tb = document.getElementById('feature-usage-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="4" class="empty-state">No feature records.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(item => \`
          <tr>
            <td><strong>\${item.feature_name}</strong></td>
            <td>\${item.usage_count.toLocaleString()}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                  <div style="width: \${item.percentage}%; height: 100%; background: #38bdf8;"></div>
                </div>
                <span>\${item.percentage}%</span>
              </div>
            </td>
            <td><span class="badge badge-success">Active</span></td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    // TAB 2: USERS
    async function fetchUsersList(search = '') {
      try {
        const query = search ? '?search=' + encodeURIComponent(search) : '';
        const res = await apiRequest('/users' + query);
        const tb = document.getElementById('users-table-body');
        const users = res.users || [];
        if (users.length === 0) {
          tb.innerHTML = '<tr><td colspan="7" class="empty-state">No users match query.</td></tr>';
          return;
        }
        tb.innerHTML = users.map(u => \`
          <tr>
            <td>
              <div style="font-weight: 600;">\${u.name}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted);">\${u.email}</div>
            </td>
            <td>\${u.phoneNumber || '--'}</td>
            <td>\${u.age || '--'}</td>
            <td>
              <span class="badge \${u.role === 'admin' ? 'badge-primary' : 'badge-warning'}">\${u.role}</span>
            </td>
            <td>
              <span class="badge \${u.isEmailVerified ? 'badge-success' : 'badge-danger'}">\${u.isEmailVerified ? 'Verified' : 'Unverified'}</span>
            </td>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(u.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="toggleUserRole('\${u.id}', '\${u.role === 'admin' ? 'user' : 'admin'}')">
                \${u.role === 'admin' ? 'Demote' : 'Promote'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteUserRecord('\${u.id}')">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    let searchTimeout;
    function handleUserSearch() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const val = document.getElementById('userSearchInput').value.trim();
        fetchUsersList(val);
      }, 300);
    }

    async function toggleUserRole(userId, newRole) {
      try {
        await apiRequest('/users/' + userId, 'PATCH', { role: newRole });
        showToast('Updated user role to ' + newRole);
        fetchUsersList(document.getElementById('userSearchInput').value.trim());
      } catch (e) {}
    }

    async function deleteUserRecord(userId) {
      if (!confirm('Are you sure you want to delete this user?')) return;
      try {
        await apiRequest('/users/' + userId, 'DELETE');
        showToast('User record removed');
        fetchUsersList(document.getElementById('userSearchInput').value.trim());
      } catch (e) {}
    }

    async function submitCreateUser() {
      const name = document.getElementById('new-user-name').value.trim();
      const email = document.getElementById('new-user-email').value.trim();
      const phone = document.getElementById('new-user-phone').value.trim();
      const age = parseInt(document.getElementById('new-user-age').value, 10);
      const role = document.getElementById('new-user-role').value;

      if (!name || !email) {
        showToast('Name and email are required', true);
        return;
      }

      try {
        await apiRequest('/users', 'POST', { name, email, phoneNumber: phone, age, role, isEmailVerified: true });
        closeModal('modal-create-user');
        showToast('✅ Created user ' + email);
        fetchUsersList();
      } catch (e) {}
    }

    // TAB 3: TRAFFIC
    async function fetchTrafficOverrides() {
      try {
        const list = await apiRequest('/traffic/overrides');
        const tb = document.getElementById('traffic-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="7" class="empty-state">No active traffic overrides.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(t => \`
          <tr>
            <td><span class="code-pill">\${t.segment_id}</span></td>
            <td>\${t.road_name || '--'}</td>
            <td><span class="badge badge-danger">\${t.congestion_level}</span></td>
            <td><strong>\${t.speed_factor}x</strong></td>
            <td>\${t.incident_description}</td>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(t.updated_at).toLocaleTimeString()}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteTrafficOverride('\${t.segment_id}')">Remove</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function submitTrafficOverride() {
      const segment_id = document.getElementById('tf-segment-id').value.trim();
      const road_name = document.getElementById('tf-road-name').value.trim();
      const congestion_level = document.getElementById('tf-congestion').value;
      const speed_factor = parseFloat(document.getElementById('tf-speed-factor').value);
      const incident_description = document.getElementById('tf-desc').value.trim();

      try {
        await apiRequest('/traffic/override', 'POST', {
          segment_id, road_name, congestion_level, speed_factor, incident_description
        });
        closeModal('modal-traffic');
        showToast('Traffic override injected');
        fetchTrafficOverrides();
      } catch (e) {}
    }

    async function deleteTrafficOverride(id) {
      try {
        await apiRequest('/traffic/override/' + encodeURIComponent(id), 'DELETE');
        showToast('Traffic override removed');
        fetchTrafficOverrides();
      } catch (e) {}
    }

    // TAB 4: WEATHER
    async function fetchWeatherOverrides() {
      try {
        const list = await apiRequest('/weather/overrides');
        const tb = document.getElementById('weather-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="7" class="empty-state">No weather overrides active.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(w => \`
          <tr>
            <td><strong>\${w.highway_name}</strong></td>
            <td>\${w.visibility_meters} m</td>
            <td><span class="badge \${w.is_dense_fog_active ? 'badge-danger' : 'badge-success'}">\${w.is_dense_fog_active ? 'YES' : 'NO'}</span></td>
            <td><span class="badge badge-warning">\${w.imd_alert_level}</span></td>
            <td>\${w.safety_advisory}</td>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(w.updated_at || Date.now()).toLocaleTimeString()}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteWeatherOverride('\${w.highway_name}')">Remove</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function submitWeatherOverride() {
      const highway_name = document.getElementById('wt-highway').value.trim();
      const visibility_meters = parseInt(document.getElementById('wt-vis').value, 10);
      const is_dense_fog_active = document.getElementById('wt-fog').value === 'true';
      const imd_alert_level = document.getElementById('wt-alert').value;
      const safety_advisory = document.getElementById('wt-advisory').value.trim();

      try {
        await apiRequest('/weather/override', 'POST', {
          highway_name, visibility_meters, is_dense_fog_active, imd_alert_level, safety_advisory
        });
        closeModal('modal-weather');
        showToast('Weather advisory broadcasted');
        fetchWeatherOverrides();
      } catch (e) {}
    }

    async function deleteWeatherOverride(name) {
      try {
        await apiRequest('/weather/override/' + encodeURIComponent(name), 'DELETE');
        showToast('Weather advisory removed');
        fetchWeatherOverrides();
      } catch (e) {}
    }

    // TAB 5: HAZARDS
    async function fetchRoadHazards() {
      try {
        const list = await apiRequest('/hazards');
        const tb = document.getElementById('hazards-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="7" class="empty-state">No road hazards reported.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(h => \`
          <tr>
            <td><span class="code-pill">\${h.id}</span></td>
            <td><strong>\${h.type}</strong></td>
            <td><span class="badge \${h.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">\${h.severity}</span></td>
            <td>\${h.location.latitude.toFixed(4)}, \${h.location.longitude.toFixed(4)}</td>
            <td>\${h.confirmations_count}</td>
            <td>\${h.description}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="verifyHazard('\${h.id}')">Verify</button>
              <button class="btn btn-danger btn-sm" onclick="deleteHazard('\${h.id}')">Dismiss</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function verifyHazard(id) {
      try {
        await apiRequest('/hazards/' + id + '/verify', 'PATCH');
        showToast('Hazard verified');
        fetchRoadHazards();
      } catch (e) {}
    }

    async function deleteHazard(id) {
      try {
        await apiRequest('/hazards/' + id, 'DELETE');
        showToast('Hazard removed');
        fetchRoadHazards();
      } catch (e) {}
    }

    // TAB 6: TOLLS
    async function fetchTollsList() {
      try {
        const list = await apiRequest('/tolls');
        const tb = document.getElementById('tolls-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="8" class="empty-state">No toll plazas configured.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(p => \`
          <tr>
            <td><strong>\${p.name}</strong></td>
            <td>\${p.highway}</td>
            <td>₹\${p.singleTripINR}</td>
            <td>₹\${p.returnTripINR}</td>
            <td>₹\${p.monthlyPassINR}</td>
            <td><span class="badge \${p.isFASTagActive ? 'badge-success' : 'badge-danger'}">\${p.isFASTagActive ? 'Active' : 'Offline'}</span></td>
            <td>\${p.operator}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="toggleFASTag('\${p.id}', \${!p.isFASTagActive})">Toggle FASTag</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function toggleFASTag(id, newStatus) {
      try {
        await apiRequest('/tolls/' + id, 'PATCH', { isFASTagActive: newStatus });
        showToast('Toll plaza FASTag status updated');
        fetchTollsList();
      } catch (e) {}
    }

    // TAB 7: PLACES
    async function fetchPlacesList() {
      try {
        const res = await apiRequest('/places');
        const tb = document.getElementById('places-table-body');
        const places = res.places || [];
        if (places.length === 0) {
          tb.innerHTML = '<tr><td colspan="7" class="empty-state">No POIs in database.</td></tr>';
          return;
        }
        tb.innerHTML = places.map(p => \`
          <tr>
            <td><strong>\${p.name}</strong></td>
            <td><span class="badge badge-primary">\${p.category}</span></td>
            <td>\${p.location?.coordinates ? p.location.coordinates.join(', ') : '--'}</td>
            <td>⭐ \${p.rating || 4.5}</td>
            <td>\${(p.tags || []).join(', ')}</td>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(p.createdAt).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deletePlaceRecord('\${p._id}')">Delete</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function deletePlaceRecord(id) {
      if (!confirm('Delete this POI?')) return;
      try {
        await apiRequest('/places/' + id, 'DELETE');
        showToast('POI deleted');
        fetchPlacesList();
      } catch (e) {}
    }

    // TAB 8: SOS
    async function fetchSOSIncidents() {
      try {
        const list = await apiRequest('/emergency/incidents');
        const tb = document.getElementById('sos-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="8" class="empty-state">No emergency incidents recorded.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(i => \`
          <tr>
            <td><span class="code-pill">\${i.incident_id}</span></td>
            <td><span class="badge badge-danger">\${i.type}</span></td>
            <td>\${i.vehicleNumber || '--'}</td>
            <td>\${i.userPhone || '--'}</td>
            <td><span class="badge \${i.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'}">\${i.status}</span></td>
            <td>\${i.location.latitude.toFixed(4)}, \${i.location.longitude.toFixed(4)}</td>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(i.timestamp).toLocaleTimeString()}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="updateSOSStatus('\${i.incident_id}', 'RESOLVED')">Resolve</button>
            </td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    async function updateSOSStatus(id, st) {
      try {
        await apiRequest('/emergency/incidents/' + id, 'PATCH', { status: st });
        showToast('SOS Incident status updated to ' + st);
        fetchSOSIncidents();
      } catch (e) {}
    }

    // TAB 9: SYSTEM HEALTH
    async function fetchSystemHealth() {
      try {
        const h = await apiRequest('/system/health');
        document.getElementById('health-db-status').innerText = h.database?.status;
        document.getElementById('health-db-status').className = 'badge ' + (h.database?.status === 'CONNECTED' ? 'badge-success' : 'badge-danger');
        document.getElementById('health-db-ping').innerText = (h.database?.ping_ms || 0) + ' ms';
        document.getElementById('health-db-host').innerText = h.database?.host || 'localhost';

        document.getElementById('health-redis-status').innerText = h.cache?.status;
        document.getElementById('health-redis-status').className = 'badge ' + (h.cache?.status === 'CONNECTED' ? 'badge-success' : 'badge-danger');
        document.getElementById('health-redis-keys').innerText = (h.cache?.total_keys || 0) + ' keys';
        document.getElementById('health-route-keys').innerText = h.cache?.route_cache_keys || 0;

        document.getElementById('health-osrm-status').innerText = h.osrm?.status;
        document.getElementById('health-osrm-status').className = 'badge ' + (h.osrm?.status === 'CONNECTED' ? 'badge-success' : 'badge-warning');
        document.getElementById('health-osrm-ping').innerText = (h.osrm?.ping_ms || 0) + ' ms';
        document.getElementById('health-osrm-url').innerText = h.osrm?.base_url || '--';

        document.getElementById('health-uptime').innerText = h.uptime_formatted;
        document.getElementById('health-heap').innerText = h.memory?.heap_used_mb || 0;
      } catch (e) {}
    }

    async function triggerCacheFlush(type = 'routes') {
      try {
        const res = await apiRequest('/system/cache/flush', 'POST', { type });
        showToast('⚡ Flushed ' + (res.keysRemoved || 0) + ' Redis cache keys (' + type + ')');
        fetchSystemHealth();
      } catch (e) {}
    }

    // TAB 10: CONFIG
    async function fetchSystemConfig() {
      try {
        const cfg = await apiRequest('/system/config');
        document.getElementById('cfg-maintenance-mode').checked = !!cfg.maintenance_mode;
        document.getElementById('cfg-navic').checked = !!cfg.navic_enhancement_enabled;
        document.getElementById('cfg-copilot').checked = !!cfg.ai_copilot_enabled;
        document.getElementById('cfg-lane').checked = !!cfg.lane_routing_enabled;
        document.getElementById('cfg-off-route').value = cfg.off_route_threshold_meters || 40;
        document.getElementById('cfg-reroute-cooldown').value = cfg.reroute_cooldown_seconds || 5;
      } catch (e) {}
    }

    async function saveSystemConfig() {
      const maintenance_mode = document.getElementById('cfg-maintenance-mode').checked;
      const navic_enhancement_enabled = document.getElementById('cfg-navic').checked;
      const ai_copilot_enabled = document.getElementById('cfg-copilot').checked;
      const lane_routing_enabled = document.getElementById('cfg-lane').checked;
      const off_route_threshold_meters = parseInt(document.getElementById('cfg-off-route').value, 10);
      const reroute_cooldown_seconds = parseInt(document.getElementById('cfg-reroute-cooldown').value, 10);

      try {
        await apiRequest('/system/config', 'PATCH', {
          maintenance_mode,
          navic_enhancement_enabled,
          ai_copilot_enabled,
          lane_routing_enabled,
          off_route_threshold_meters,
          reroute_cooldown_seconds,
        });
        showToast('Dynamic system configurations updated');
      } catch (e) {}
    }

    // TAB 11: AUDIT
    async function fetchAuditLogs() {
      try {
        const list = await apiRequest('/audit-logs');
        const tb = document.getElementById('audit-table-body');
        if (!list || list.length === 0) {
          tb.innerHTML = '<tr><td colspan="5" class="empty-state">No audit events recorded.</td></tr>';
          return;
        }
        tb.innerHTML = list.map(a => \`
          <tr>
            <td style="font-size: 0.75rem; color: var(--text-dim);">\${new Date(a.timestamp).toLocaleString()}</td>
            <td><strong style="color: #38bdf8;">\${a.admin_email}</strong></td>
            <td><span class="code-pill">\${a.action}</span></td>
            <td>\${a.target_type} \${a.target_id ? '(' + a.target_id + ')' : ''}</td>
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">\${a.ip_address || '127.0.0.1'}</td>
          </tr>
        \`).join('');
      } catch (e) {}
    }

    // On load initialization
    window.addEventListener('DOMContentLoaded', () => {
      const savedToken = localStorage.getItem('bmap_admin_jwt');
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('token');

      if (queryToken) {
        localStorage.setItem('bmap_admin_jwt', queryToken);
        document.getElementById('adminTokenInput').value = queryToken;
        // Security Remediation (CWE-598): Strip JWT query parameter from URL bar to prevent log & referer leakage
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (savedToken) {
        document.getElementById('adminTokenInput').value = savedToken;
      }

      fetchOverviewMetrics();
    });
  </script>
</body>
</html>
`;
};
