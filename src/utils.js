import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export const confirmAlert = async (title, text) => {
    const result = await MySwal.fire({
        title: title || 'Tem certeza?',
        text: text || "Você não poderá reverter isso!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#7c43bd', // var(--primary)
        cancelButtonColor: '#ef4444', // var(--danger)
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar',
        background: '#ffffff',
        borderRadius: '12px'
    });
    return result.isConfirmed;
};

export const successAlert = (text) => {
    MySwal.fire({
        text: text,
        icon: 'success',
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
};

export const errorAlert = (title, text) => {
    MySwal.fire({
        title: title || 'Atenção',
        text: text,
        icon: 'error',
        confirmButtonColor: '#7c43bd',
        confirmButtonText: 'Entendi',
        borderRadius: '12px'
    });
};
