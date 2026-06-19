export interface Interaction {
  drugs: [string, string];
  severity: "high" | "moderate";
  warning: string;
}

const INTERACTIONS: Interaction[] = [
  { drugs: ["Warfarin", "Aspirin"], severity: "high", warning: "Significantly increased bleeding risk. Avoid combination or monitor closely." },
  { drugs: ["Warfarin", "Ibuprofen"], severity: "high", warning: "Increased bleeding risk and reduced anticoagulation effect." },
  { drugs: ["Warfarin", "Diclofenac"], severity: "high", warning: "NSAIDs increase anticoagulant effect of Warfarin. High bleeding risk." },
  { drugs: ["Clopidogrel", "Aspirin"], severity: "moderate", warning: "Dual antiplatelet therapy — increased bleeding risk. Only use if clinically indicated." },
  { drugs: ["Clopidogrel", "Omeprazole"], severity: "moderate", warning: "Omeprazole reduces Clopidogrel effectiveness. Consider Pantoprazole instead." },
  { drugs: ["Metformin", "Alcohol"], severity: "high", warning: "Risk of lactic acidosis. Patient should avoid alcohol entirely." },
  { drugs: ["Diazepam", "Alprazolam"], severity: "high", warning: "Double benzodiazepine — severe CNS and respiratory depression risk." },
  { drugs: ["Sertraline", "Fluoxetine"], severity: "high", warning: "Risk of Serotonin Syndrome — avoid combining SSRIs." },
  { drugs: ["Sertraline", "Tramadol"], severity: "high", warning: "Risk of Serotonin Syndrome and seizures." },
  { drugs: ["Fluoxetine", "Tramadol"], severity: "high", warning: "Risk of Serotonin Syndrome and seizures." },
  { drugs: ["Metformin", "Ciprofloxacin"], severity: "moderate", warning: "Ciprofloxacin may alter blood sugar levels. Monitor glucose closely." },
  { drugs: ["Atorvastatin", "Clarithromycin"], severity: "high", warning: "Increased statin levels — risk of myopathy and rhabdomyolysis." },
  { drugs: ["Simvastatin", "Clarithromycin"], severity: "high", warning: "Increased statin levels — risk of myopathy and rhabdomyolysis." },
  { drugs: ["Amlodipine", "Clarithromycin"], severity: "moderate", warning: "Clarithromycin increases amlodipine levels. Monitor blood pressure." },
  { drugs: ["Ramipril", "Losartan"], severity: "high", warning: "Dual RAAS blockade — risk of hypotension, renal failure, and hyperkalemia." },
  { drugs: ["Furosemide", "Spironolactone"], severity: "moderate", warning: "Monitor potassium levels — combined diuretics can cause electrolyte imbalance." },
  { drugs: ["Haloperidol", "Quetiapine"], severity: "moderate", warning: "Additive QT prolongation risk. Monitor ECG." },
  { drugs: ["Methotrexate", "Ibuprofen"], severity: "high", warning: "NSAIDs reduce methotrexate excretion — serious toxicity risk." },
  { drugs: ["Allopurinol", "Azathioprine"], severity: "high", warning: "Allopurinol drastically increases azathioprine toxicity. Avoid or reduce dose." },
  { drugs: ["Codeine", "Tramadol"], severity: "moderate", warning: "Additive opioid effect — increased sedation and respiratory depression risk." },
  { drugs: ["Aspirin", "Ibuprofen"], severity: "moderate", warning: "Ibuprofen may interfere with aspirin's antiplatelet effect." },
  { drugs: ["Bisoprolol", "Amlodipine"], severity: "moderate", warning: "Additive bradycardia risk. Monitor heart rate." },
  { drugs: ["Dexamethasone", "Ibuprofen"], severity: "moderate", warning: "Increased risk of GI bleeding and peptic ulcers." },
  { drugs: ["Prednisolone", "Ibuprofen"], severity: "moderate", warning: "Increased risk of GI bleeding and peptic ulcers." },
];

export function checkDrugInteractions(medicationNames: string[]): Interaction[] {
  const found: Interaction[] = [];
  const names = medicationNames.map(n => n.toLowerCase());

  for (const interaction of INTERACTIONS) {
    const [a, b] = interaction.drugs;
    if (
      names.some(n => n.includes(a.toLowerCase())) &&
      names.some(n => n.includes(b.toLowerCase()))
    ) {
      found.push(interaction);
    }
  }

  return found;
}
