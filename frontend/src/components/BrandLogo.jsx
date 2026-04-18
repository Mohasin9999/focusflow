import React from 'react';
import logo from '../assets/logo.png';

export const BRAND_LOGO_IMAGE_CLASS = 'w-full h-full object-cover object-[50%_55%] scale-150 origin-center';

export default function BrandLogo({ wrapperClassName, imageClassName = BRAND_LOGO_IMAGE_CLASS, alt = 'FocusFlow logo' }) {
    return (
        <div className={wrapperClassName}>
            <img src={logo} alt={alt} className={imageClassName} />
        </div>
    );
}
