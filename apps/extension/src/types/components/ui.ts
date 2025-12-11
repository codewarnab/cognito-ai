/**
 * UI component types
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export interface IconButtonProps extends ButtonProps {
    icon: React.ReactNode;
    'aria-label': string;
}

export interface TooltipProps {
    content: string;
    children: React.ReactNode;
    placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface DropdownProps {
    trigger: React.ReactNode;
    items: DropdownItem[];
    onSelect: (value: string) => void;
}

export interface DropdownItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    danger?: boolean;
}

export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}
