
// format date picker to allow only 18 years +

export function formatDatePicker():string{
    const minimumAge = 18;
  const newDate = new Date();
  newDate.setFullYear(newDate.getFullYear() - minimumAge);
  return newDate.toISOString().split('T')[0];
   
}