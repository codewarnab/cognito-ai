import React from 'react';
import { MeshGradientSVG } from '../../shared/effects';

export const WelcomePage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-start flex-1 min-h-0 p-5 text-center w-full gap-5 box-border">
            <div className="w-full px-5 mb-5">
                <h1 className="text-2xl font-bold m-0 mb-4 bg-gradient-to-br from-white to-gray-100 bg-clip-text text-transparent whitespace-nowrap">
                    Welcome to Cognito
                </h1>
                <p className="text-sm font-normal text-gray-400 m-0 mb-4 leading-relaxed">
                    Your autonomous AI browser agent that navigates, clicks, fills forms, and executes tasks end-to-end
                </p>
            </div>

            <div className="flex-1 flex items-center justify-center w-full my-10">
                <div className="flex items-center justify-center">
                    <MeshGradientSVG size={280} />
                </div>
            </div>
        </div>
    );
};
