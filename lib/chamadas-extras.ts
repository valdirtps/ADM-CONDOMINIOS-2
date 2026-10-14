export function getActiveChamadasExtras(allChamadasExtras: any[], currentMesAno: string) {
  return allChamadasExtras.filter(ce => {
     if (ce.mes_ano > currentMesAno) return false;
     
     const [y1, m1] = ce.mes_ano.split('-').map(Number);
     const [y2, m2] = currentMesAno.split('-').map(Number);
     
     const monthsDiff = (y2 - y1) * 12 + (m2 - m1);
     
     // Parcela 1 is when monthsDiff = 0
     // We charge up to monthsDiff = parcelas - 1
     return monthsDiff >= 0 && monthsDiff < (ce.parcelas || 1);
  }).map(ce => {
     const [y1, m1] = ce.mes_ano.split('-').map(Number);
     const [y2, m2] = currentMesAno.split('-').map(Number);
     const monthsDiff = (y2 - y1) * 12 + (m2 - m1);
     return {
        ...ce,
        current_parcela: monthsDiff + 1,
     };
  });
}
