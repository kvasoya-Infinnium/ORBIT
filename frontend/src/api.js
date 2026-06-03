// src/api.js
// One small wrapper around axios. Every backend call lives here so the rest of
// the UI never has to know URLs.
//
// BASE is derived from the address you opened the app with, so it works from any
// machine: open the UI at http://192.168.1.50:8080 and the API calls go to
// http://192.168.1.50:8000 automatically. (The backend must run on port 8000 and
// listen on the network — see the run command in the README.)
// To force a specific backend, set VITE_API_BASE in frontend/.env.
import axios from "axios";

const BASE =
  import.meta.env.VITE_API_BASE ||
  `${window.location.protocol}//${window.location.hostname}:8000`;
const http = axios.create({ baseURL: BASE });

export const api = {
  base: BASE,   // exposed so the UI can show which backend it's talking to
  listConnectors: () => http.get("/connectors").then((r) => r.data),
  listTypes: () => http.get("/connector-types").then((r) => r.data),
  addConnector: (type_id, label) =>
    http.post("/connectors", { type_id, label }).then((r) => r.data),
  removeConnector: (id) => http.delete(`/connectors/${id}`).then((r) => r.data),
  testConnector: (id) => http.post(`/connectors/${id}/test`).then((r) => r.data),
  connect: (id, creds) => http.post(`/connectors/${id}/connect`, creds).then((r) => r.data),
  query: (question, connector_ids, { signal } = {}) =>
    http.post("/query", { question, connector_ids }, { signal }).then((r) => r.data),
  audit: () => http.get("/audit").then((r) => r.data),
  historyDetail: (query_id) => http.get(`/history/${query_id}`).then((r) => r.data),
  rebind: (query_id) => http.post(`/history/${query_id}/rebind`).then((r) => r.data),
  browse: () => http.get("/browse").then((r) => r.data),
  export: (query_id, format) =>
    http.post("/export", { query_id, format }, { responseType: "blob" }).then((r) => r.data),
};
