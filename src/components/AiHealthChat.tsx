import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "bot";
  text: string;
}

const KNOWLEDGE_BASE: { keywords: string[]; response: string }[] = [
  {
    keywords: ["headache", "head pain", "migraine", "صداع"],
    response: "Headaches can be caused by dehydration, stress, lack of sleep, or eye strain. Drink water, rest in a dark room, and take paracetamol if needed. If pain is severe, sudden, or with fever/stiff neck — see a doctor immediately as it may indicate meningitis.",
  },
  {
    keywords: ["fever", "temperature", "high temp", "حمى"],
    response: "A fever above 38°C (100.4°F) signals your body is fighting infection. Stay hydrated, rest, and take paracetamol or ibuprofen. See a doctor if: fever > 39.5°C, lasts > 3 days, with severe symptoms, or in children under 3 months.",
  },
  {
    keywords: ["chest pain", "chest", "heart", "ألم صدر"],
    response: "⚠️ Chest pain is serious. If you have crushing pain, shortness of breath, pain radiating to arm/jaw — CALL EMERGENCY SERVICES NOW. Not all chest pain is a heart attack (can be muscle, acid reflux), but always get it checked urgently.",
  },
  {
    keywords: ["diabetes", "sugar", "glucose", "سكري", "blood sugar"],
    response: "Diabetes management: take medications as prescribed, monitor blood sugar regularly, follow a low-sugar diet (reduce white rice, bread, sweets), exercise 30 min/day, and attend regular checkups. Target fasting blood sugar: 80–130 mg/dL.",
  },
  {
    keywords: ["blood pressure", "hypertension", "ضغط دم", "hyper"],
    response: "Normal blood pressure is below 120/80 mmHg. For hypertension: take prescribed medication daily (never skip), reduce salt intake, exercise regularly, avoid smoking and alcohol, manage stress. Monitor at home and report readings > 180/120 to doctor immediately.",
  },
  {
    keywords: ["cough", "cold", "flu", "سعال", "زكام"],
    response: "For common cold/cough: rest, drink warm fluids, honey and lemon help. Antihistamines for runny nose. See doctor if: cough > 3 weeks, blood in mucus, high fever, or difficulty breathing.",
  },
  {
    keywords: ["diarrhea", "stomach", "vomiting", "nausea", "إسهال", "غثيان"],
    response: "Stay hydrated with water and oral rehydration salts (ORS). Eat bland foods (rice, banana, toast). Avoid dairy and fatty foods. See doctor if: blood in stool, vomiting > 24h, signs of dehydration (dark urine, dizziness), or in young children/elderly.",
  },
  {
    keywords: ["sleep", "insomnia", "tired", "نوم", "أرق"],
    response: "Good sleep hygiene: consistent sleep schedule, dark and cool room, no screens 1h before bed, avoid caffeine after 2pm. If insomnia persists > 1 month, see a doctor. Melatonin can help short-term. Avoid sleep medications without prescription.",
  },
  {
    keywords: ["weight", "diet", "obesity", "وزن", "رجيم"],
    response: "Healthy weight: aim for 0.5–1 kg/week loss. Focus on: vegetables, lean protein, whole grains. Reduce processed foods, sugary drinks. 150 min of moderate exercise weekly. Consult a nutritionist for a personalized plan. Crash diets are harmful.",
  },
  {
    keywords: ["allergy", "rash", "itching", "حساسية", "طفح"],
    response: "Identify and avoid allergens. For mild reactions: antihistamines (cetirizine, loratadine). For skin rashes: topical corticosteroids. If severe reaction (swollen throat, difficulty breathing) — EMERGENCY: this is anaphylaxis. If you have an EpiPen, use it.",
  },
  {
    keywords: ["pregnancy", "pregnant", "حمل"],
    response: "Key pregnancy tips: take folic acid (400–800mcg) daily, attend all prenatal checkups, avoid alcohol/smoking/raw fish, stay hydrated. Danger signs needing immediate care: heavy bleeding, severe abdominal pain, decreased fetal movement after 28 weeks.",
  },
  {
    keywords: ["vaccine", "vaccination", "vaccination", "تطعيم", "لقاح"],
    response: "Vaccines are safe and essential for disease prevention. Key adult vaccines: flu (yearly), tetanus booster (every 10y), COVID-19 (updated), hepatitis B, pneumococcal (over 65). Ask your SPITAR doctor for your personalized vaccine schedule.",
  },
  {
    keywords: ["medication", "medicine", "drug", "دواء", "علاج"],
    response: "Always take medications as prescribed. Don't stop antibiotics early even if you feel better. Don't share medications. Check expiry dates. Store properly (most need cool, dry place). Report side effects to your doctor. Never mix alcohol with medications without checking.",
  },
  {
    keywords: ["emergency", "urgent", "طوارئ"],
    response: "⚠️ For life-threatening emergencies: call local emergency services immediately. Signs requiring immediate care: chest pain, stroke symptoms (face drooping, arm weakness, speech difficulty), severe bleeding, loss of consciousness, difficulty breathing, severe allergic reaction.",
  },
  {
    keywords: ["depression", "anxiety", "mental", "stress", "اكتئاب", "قلق"],
    response: "Mental health matters. Depression and anxiety are medical conditions, not weakness. Symptoms include persistent sadness, loss of interest, fatigue, or excessive worry. Treatments include therapy and/or medication. If you have thoughts of self-harm, call a crisis line or go to emergency immediately.",
  },
];

const GREETINGS = [
  "مرحباً", "hello", "hi", "hey", "السلام", "مساء", "صباح", "bonjour", "salut",
];

function getResponse(input: string): string {
  const lower = input.toLowerCase();

  if (GREETINGS.some(g => lower.includes(g))) {
    return "Hello! I'm the SPITAR Health Assistant 👋 I can answer general health questions. Ask me about symptoms, medications, diabetes, blood pressure, or any health topic. Remember: I'm not a replacement for your doctor — always consult a medical professional for diagnosis and treatment.";
  }

  for (const entry of KNOWLEDGE_BASE) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return entry.response;
    }
  }

  return "I don't have specific information on that topic. For accurate medical advice, please consult your doctor through the **Teleconsultation** feature or book an appointment. In emergencies, call local emergency services immediately.";
}

export function AiHealthChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Hello! I'm the SPITAR Health Assistant 🩺 Ask me general health questions about symptoms, medications, or health tips. I'm not a replacement for your doctor, but I can provide general guidance.",
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      const reply = getResponse(text);
      setMessages(prev => [...prev, { role: "bot", text: reply }]);
    }, 400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520, background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #0891b2, #2563eb)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bot size={18} style={{ color: "#fff" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>SPITAR Health Assistant</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>AI-powered health guidance · Not a medical diagnosis</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-end" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.role === "bot" ? "linear-gradient(135deg, #0891b2, #2563eb)" : "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {m.role === "bot"
                ? <Bot size={14} style={{ color: "#fff" }} />
                : <User size={14} style={{ color: "#fff" }} />
              }
            </div>
            <div style={{
              maxWidth: "75%",
              padding: "10px 14px",
              borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              background: m.role === "user" ? "linear-gradient(135deg, #7c3aed, #2563eb)" : "#f1f5f9",
              color: m.role === "user" ? "#fff" : "#0f172a",
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Ask a health question..."
          style={{ flex: 1, height: 42, padding: "0 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, outline: "none", background: "#f8fafc" }}
        />
        <button onClick={send} disabled={!input.trim()}
          style={{ width: 42, height: 42, borderRadius: 12, background: input.trim() ? "linear-gradient(135deg, #0891b2, #2563eb)" : "#e2e8f0", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Send size={16} style={{ color: input.trim() ? "#fff" : "#94a3b8" }} />
        </button>
      </div>
    </div>
  );
}
