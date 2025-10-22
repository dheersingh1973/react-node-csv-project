import axios from 'axios';

export const generateReceipt = async (orderId) => {
  try {
    const response = await axios.get(`http://localhost:5000/api/generate-receipt/${orderId}`, {
      responseType: 'blob' // Important for handling file downloads
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `receipt_${orderId}.pdf`); // Set the desired filename
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error generating receipt:', err);
    alert('Failed to generate receipt.');
  }
};
