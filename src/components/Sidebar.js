import React from "react";

const Sidebar = ({ currentStep, setCurrentStep, steps, competitionName }) => {
  // Vérifier si une étape peut être accessible
  const isStepAccessible = (stepIndex) => {
    // L'étape 0 (liste des compétitions) est toujours accessible
    if (stepIndex === 0) return true;

    // Pour les autres étapes, elles ne sont accessibles que si
    // l'utilisateur a déjà atteint cette étape ou une étape ultérieure
    return stepIndex <= currentStep;
  };

  // Gérer le clic sur une étape
  const handleStepClick = (stepIndex) => {
    if (isStepAccessible(stepIndex)) {
      setCurrentStep(stepIndex);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-title">
        {competitionName || "Compétition de Taekwondo"}
      </div>
      <ul className="sidebar-steps">
        {steps.map((step, index) => (
          <li
            key={index}
            className={`sidebar-step ${currentStep === index ? "active" : ""} ${
              !isStepAccessible(index) ? "disabled" : ""
            }`}
            onClick={() => handleStepClick(index)}
          >
            <div className="sidebar-step-number">{index}</div>
            <div className="sidebar-step-label">{step}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;
