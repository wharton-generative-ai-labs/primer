import React from 'react';

/**
 * Page-level "Experience Creator"-style title heading rendered between the
 * Header and the panel content area.
 *
 * Style follows Figma (frame `601:6481`): serif (Minion Pro), bold, 36px,
 * brand color, centered, generous bottom margin.
 */
const ExperienceTitle: React.FC<{ title: string }> = ({ title }) => (
    <h1
        className="text-center font-serif text-4xl font-bold text-brand"
    >
        {title}
    </h1>
);

export default ExperienceTitle;
