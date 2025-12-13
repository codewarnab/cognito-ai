import React from 'react';
import integrationsImage from '@assets/images/intregations.png';

export const GetStartedPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-start flex-1 min-h-0 p-5 pt-0 text-center w-full max-w-full gap-5 box-border">
            <div className="max-w-[400px] mb-0 mt-0">
                <h1 className="text-2xl font-bold m-0 mb-2 bg-gradient-to-br from-white to-gray-100 bg-clip-text text-transparent">
                    Connect to 15+ Platforms
                </h1>
                <p className="text-sm font-normal text-gray-400 m-0 mb-2 leading-snug">
                    Seamlessly integrate with your favorite tools and services, with more platforms coming soon
                </p>
            </div>

            <div className="-mt-10 flex justify-center items-center flex-1 overflow-visible w-full min-h-[400px] max-h-none py-[5px] px-5 box-border">
                <img
                    src={integrationsImage}
                    alt="Connect to 15+ Platforms"
                    className="w-auto h-auto max-w-full max-h-none object-contain rounded-xl shadow-lg block"
                />
            </div>
        </div>
    );
};
