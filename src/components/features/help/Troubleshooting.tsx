import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../ui/primitives/accordion';
import { troubleshootingData } from '../../data';
import './Troubleshooting.css';

interface TroubleshootingProps {
    onBack: () => void;
}

export const Troubleshooting: React.FC<TroubleshootingProps> = ({ onBack }) => {
    return (
        <div className="troubleshooting-container">
            {/* Header */}
            <div className="troubleshooting-header">
                <div className="troubleshooting-header-content">
                    <button
                        className="troubleshooting-back-button"
                        onClick={onBack}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="troubleshooting-header-text">
                        <h1 className="troubleshooting-title">Troubleshooting Guide</h1>
                        <p className="troubleshooting-subtitle">
                            Common issues and solutions to help you get back on track
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="troubleshooting-content">
                <Accordion type="single">
                    {troubleshootingData.map((item) => (
                        <AccordionItem key={item.id} value={item.id}>
                            <AccordionTrigger>{item.issue}</AccordionTrigger>
                            <AccordionContent>
                                <div className="troubleshooting-section">
                                    <h3 className="troubleshooting-section-title">
                                        Possible Causes:
                                    </h3>
                                    <ul className="troubleshooting-list">
                                        {item.causes.map((cause, idx) => (
                                            <li key={idx}>{cause}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="troubleshooting-section">
                                    <h3 className="troubleshooting-section-title">
                                        Solutions:
                                    </h3>
                                    <ol className="troubleshooting-list troubleshooting-list-ordered">
                                        {item.solutions.map((solution, idx) => (
                                            <li key={idx}>{solution}</li>
                                        ))}
                                    </ol>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
};
