import type {
  AdvisesEdge,
  ExpertNode,
  FarmerNode,
  GraphSnapshot,
  KnowsEdge,
  PracticeNode,
  RecommendsEdge,
} from "./types";

/**
 * Demo seed: 3 experts, 15 farmers, 5 practices.
 * Tuned so that 1–4 adoptions per round is typical — see PRD §9 risk mitigations.
 */

const date = (d: string) => new Date(d).toISOString();

export const EXPERTS: ExpertNode[] = [
  {
    id: "e_meera",
    type: "expert",
    name: "Dr. Meera Otieno",
    domain: "Soil & water management",
    institution: "Kenya Agricultural Research Institute",
    credibilityScore: 0.92,
    agentId: null,
    mood: "happy",
  },
  {
    id: "e_kamau",
    type: "expert",
    name: "James Kamau",
    domain: "Integrated pest management",
    institution: "Egerton University",
    credibilityScore: 0.81,
    agentId: null,
    mood: "wink",
  },
  {
    id: "e_amina",
    type: "expert",
    name: "Dr. Amina Hassan",
    domain: "Smallholder yield optimization",
    institution: "ICRAF Nairobi",
    credibilityScore: 0.87,
    agentId: null,
    mood: "happy",
  },
];

export const PRACTICES: PracticeNode[] = [
  {
    id: "p_drip",
    type: "practice",
    name: "Drip irrigation",
    category: "water",
    complexity: 3,
    evidenceLevel: "high",
  },
  {
    id: "p_cover",
    type: "practice",
    name: "Cover cropping",
    category: "soil",
    complexity: 2,
    evidenceLevel: "high",
  },
  {
    id: "p_push_pull",
    type: "practice",
    name: "Push-pull pest control",
    category: "pest",
    complexity: 4,
    evidenceLevel: "high",
  },
  {
    id: "p_intercrop",
    type: "practice",
    name: "Maize-legume intercropping",
    category: "yield",
    complexity: 2,
    evidenceLevel: "medium",
  },
  {
    id: "p_compost",
    type: "practice",
    name: "On-farm composting",
    category: "soil",
    complexity: 1,
    evidenceLevel: "medium",
  },
];

const farmerSeeds: Array<Pick<FarmerNode, "id" | "name" | "region" | "farmSize" | "adoptionRate" | "mood">> = [
  { id: "f_wanjiru", name: "Wanjiru", region: "Nyeri", farmSize: 2.5, adoptionRate: 0.72, mood: "happy" },
  { id: "f_otieno", name: "Otieno", region: "Kisumu", farmSize: 1.8, adoptionRate: 0.58, mood: "happy" },
  { id: "f_chebet", name: "Chebet", region: "Bomet", farmSize: 3.0, adoptionRate: 0.81, mood: "wink" },
  { id: "f_njoroge", name: "Njoroge", region: "Kiambu", farmSize: 2.0, adoptionRate: 0.65, mood: "happy" },
  { id: "f_akinyi", name: "Akinyi", region: "Siaya", farmSize: 1.2, adoptionRate: 0.45, mood: "happy" },
  { id: "f_kiprop", name: "Kiprop", region: "Uasin Gishu", farmSize: 4.0, adoptionRate: 0.77, mood: "happy" },
  { id: "f_mumbi", name: "Mumbi", region: "Murang'a", farmSize: 2.2, adoptionRate: 0.6, mood: "wink" },
  { id: "f_omondi", name: "Omondi", region: "Homa Bay", farmSize: 1.5, adoptionRate: 0.5, mood: "happy" },
  { id: "f_naliaka", name: "Naliaka", region: "Bungoma", farmSize: 2.8, adoptionRate: 0.68, mood: "happy" },
  { id: "f_korir", name: "Korir", region: "Kericho", farmSize: 3.2, adoptionRate: 0.74, mood: "happy" },
  { id: "f_nyambura", name: "Nyambura", region: "Nyeri", farmSize: 1.0, adoptionRate: 0.4, mood: "surprised" },
  { id: "f_ouma", name: "Ouma", region: "Kisumu", farmSize: 2.0, adoptionRate: 0.55, mood: "happy" },
  { id: "f_jelimo", name: "Jelimo", region: "Elgeyo", farmSize: 2.6, adoptionRate: 0.7, mood: "happy" },
  // resistant cluster — tuned low to demonstrate spread blocking
  { id: "f_rotich", name: "Rotich", region: "Nakuru", farmSize: 1.8, adoptionRate: 0.18, mood: "surprised" },
  { id: "f_kibet", name: "Kibet", region: "Nakuru", farmSize: 2.1, adoptionRate: 0.22, mood: "surprised" },
];

export const FARMERS: FarmerNode[] = farmerSeeds.map((f) => ({
  ...f,
  type: "farmer" as const,
  adoptedPractices: [],
}));

export const RECOMMENDS: RecommendsEdge[] = [
  { id: "r_meera_drip", type: "RECOMMENDS", source: "e_meera", target: "p_drip", confidence: 0.95, date: date("2025-01-15") },
  { id: "r_meera_cover", type: "RECOMMENDS", source: "e_meera", target: "p_cover", confidence: 0.88, date: date("2025-01-20") },
  { id: "r_kamau_pp", type: "RECOMMENDS", source: "e_kamau", target: "p_push_pull", confidence: 0.93, date: date("2025-02-01") },
  { id: "r_kamau_inter", type: "RECOMMENDS", source: "e_kamau", target: "p_intercrop", confidence: 0.78, date: date("2025-02-10") },
  { id: "r_amina_compost", type: "RECOMMENDS", source: "e_amina", target: "p_compost", confidence: 0.85, date: date("2025-02-15") },
  { id: "r_amina_inter", type: "RECOMMENDS", source: "e_amina", target: "p_intercrop", confidence: 0.82, date: date("2025-02-20") },
];

export const ADVISES: AdvisesEdge[] = [
  { id: "a_meera_wanjiru", type: "ADVISES", source: "e_meera", target: "f_wanjiru", channel: "field-day", date: date("2025-03-01") },
  { id: "a_meera_chebet", type: "ADVISES", source: "e_meera", target: "f_chebet", channel: "training", date: date("2025-03-05") },
  { id: "a_meera_kiprop", type: "ADVISES", source: "e_meera", target: "f_kiprop", channel: "radio", date: date("2025-03-10") },
  { id: "a_kamau_otieno", type: "ADVISES", source: "e_kamau", target: "f_otieno", channel: "field-day", date: date("2025-03-12") },
  { id: "a_kamau_njoroge", type: "ADVISES", source: "e_kamau", target: "f_njoroge", channel: "sms", date: date("2025-03-14") },
  { id: "a_amina_mumbi", type: "ADVISES", source: "e_amina", target: "f_mumbi", channel: "training", date: date("2025-03-18") },
  { id: "a_amina_korir", type: "ADVISES", source: "e_amina", target: "f_korir", channel: "field-day", date: date("2025-03-20") },
];

// Trust-weighted peer network. Higher weights cluster around shared regions.
export const KNOWS: KnowsEdge[] = [
  { id: "k_wanjiru_nyambura", type: "KNOWS", source: "f_wanjiru", target: "f_nyambura", trustWeight: 0.85 },
  { id: "k_wanjiru_njoroge", type: "KNOWS", source: "f_wanjiru", target: "f_njoroge", trustWeight: 0.7 },
  { id: "k_njoroge_mumbi", type: "KNOWS", source: "f_njoroge", target: "f_mumbi", trustWeight: 0.65 },
  { id: "k_mumbi_nyambura", type: "KNOWS", source: "f_mumbi", target: "f_nyambura", trustWeight: 0.6 },
  { id: "k_otieno_akinyi", type: "KNOWS", source: "f_otieno", target: "f_akinyi", trustWeight: 0.78 },
  { id: "k_otieno_omondi", type: "KNOWS", source: "f_otieno", target: "f_omondi", trustWeight: 0.82 },
  { id: "k_omondi_ouma", type: "KNOWS", source: "f_omondi", target: "f_ouma", trustWeight: 0.7 },
  { id: "k_akinyi_naliaka", type: "KNOWS", source: "f_akinyi", target: "f_naliaka", trustWeight: 0.55 },
  { id: "k_chebet_jelimo", type: "KNOWS", source: "f_chebet", target: "f_jelimo", trustWeight: 0.88 },
  { id: "k_chebet_kiprop", type: "KNOWS", source: "f_chebet", target: "f_kiprop", trustWeight: 0.75 },
  { id: "k_kiprop_korir", type: "KNOWS", source: "f_kiprop", target: "f_korir", trustWeight: 0.8 },
  { id: "k_korir_jelimo", type: "KNOWS", source: "f_korir", target: "f_jelimo", trustWeight: 0.72 },
  { id: "k_jelimo_naliaka", type: "KNOWS", source: "f_jelimo", target: "f_naliaka", trustWeight: 0.5 },
  // resistant cluster — low-trust ties to the network's edge
  { id: "k_rotich_kibet", type: "KNOWS", source: "f_rotich", target: "f_kibet", trustWeight: 0.45 },
  { id: "k_kiprop_rotich", type: "KNOWS", source: "f_kiprop", target: "f_rotich", trustWeight: 0.3 },
];

export function buildSeedSnapshot(): GraphSnapshot {
  return {
    nodes: [...EXPERTS, ...FARMERS, ...PRACTICES],
    edges: [...RECOMMENDS, ...ADVISES, ...KNOWS],
    round: 0,
  };
}
