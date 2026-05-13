const PDFDocument=require('pdfkit');
const W=595.28,H=841.89,MAR=40,CW=515.28;
const C={header:[48,76,88],azul:[60,120,218],naranja:[224,75,55],blanco:[255,255,255],negro:[26,26,26],gris1:[245,245,245],gris2:[228,228,228],verde:[26,107,60],subtxt:[102,102,102]};
const hex=a=>`#${a.map(v=>v.toString(16).padStart(2,'0')).join('')}`;
const fE=n=>'€'+Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2});
const fP=n=>(Number(n||0)>=0?'+':'')+(Number(n||0)*100).toFixed(2)+'%';
const fD=d=>{try{return new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});}catch{return d||'—';}};

function portada(doc,tipo,nombre,email,fecha,kpis){
  doc.rect(0,0,W,H).fill(hex(C.header));
  doc.rect(W*.55,0,W*.45,H*.45).fill([36,60,70]);
  doc.rect(0,H*.38,W,5).fill(hex(C.azul));
  doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(32).text('DIGSA',MAR,50);
  doc.fillColor(hex(C.azul)).font('Helvetica').fontSize(8).text('E S P A Ñ A',MAR,88,{characterSpacing:3});
  doc.rect(MAR,108,45,2).fill(hex(C.naranja));
  doc.fillColor('rgba(255,255,255,0.45)').font('Helvetica').fontSize(10).text(tipo.toUpperCase(),MAR,H*.32,{characterSpacing:2});
  doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(24).text(nombre,MAR,H*.38+18,{width:W-MAR*2});
  doc.fillColor('rgba(255,255,255,0.55)').font('Helvetica').fontSize(11).text(email,MAR,H*.38+52);
  doc.fillColor(hex(C.azul)).fontSize(10).text(fD(fecha),MAR,H*.38+72);
  if(kpis&&kpis.length>0){
    const kw=(W-MAR*2-(kpis.length-1)*10)/kpis.length;
    kpis.forEach((k,i)=>{const kx=MAR+i*(kw+10),ky=H*.72;doc.rect(kx,ky,kw,78).fill([36,60,70]);doc.rect(kx,ky,kw,3).fill(hex(k.color||C.azul));doc.fillColor('rgba(255,255,255,0.45)').font('Helvetica').fontSize(7).text(k.label.toUpperCase(),kx+10,ky+10,{width:kw-20,characterSpacing:.3});doc.fillColor(hex(k.color||C.blanco)).font('Helvetica-Bold').fontSize(15).text(k.valor,kx+10,ky+22,{width:kw-20});});
  }
  doc.rect(0,H-32,W,32).fill([36,60,70]);
  doc.fillColor('rgba(255,255,255,0.3)').font('Helvetica').fontSize(7.5).text('Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires  ·  digsa.es',MAR,H-20,{width:W-MAR*2,align:'center'});
}

function iHeader(doc,tipo,nombre,fecha){
  doc.rect(0,0,W,100).fill(hex(C.header));
  doc.rect(0,100,W,6).fill(hex(C.azul));
  doc.rect(0,106,W,16).fill(hex(C.header));
  doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(16).text('DIGSA',MAR,18);
  doc.fillColor(hex(C.azul)).font('Helvetica').fontSize(6).text('ESPAÑA',MAR,38,{characterSpacing:2});
  doc.rect(MAR,58,25,2).fill(hex(C.naranja));
  doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(11).text(tipo,W/2,16,{width:W/2-MAR,align:'right'});
  doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(9).text(nombre,W/2,32,{width:W/2-MAR,align:'right'});
  doc.fillColor(hex(C.azul)).fontSize(8).text(fD(fecha),W/2,48,{width:W/2-MAR,align:'right'});
}

function footer(doc,p,t){const y=H-28;doc.rect(0,y,W,28).fill(hex(C.header));doc.fillColor('rgba(255,255,255,0.35)').font('Helvetica').fontSize(7).text('digsa.es  ·  Villanueva 27, Madrid  ·  La Pampa 1517 3°C, Buenos Aires',MAR,y+8,{width:W-MAR*2,align:'center'});doc.fillColor('rgba(255,255,255,0.25)').fontSize(7).text(`${p}/${t}`,W-MAR-12,y+8);}

function gracias(doc,nombre){doc.rect(0,0,W,H).fill(hex(C.header));doc.rect(0,0,W,H*.45).fill([36,60,70]);doc.rect(0,H*.45,W,5).fill(hex(C.azul));doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(36).text('Muchas Gracias',0,H*.5-60,{align:'center',width:W});doc.fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(13).text(`${nombre}, gracias por confiar en DIGSA España.`,0,H*.5,{align:'center',width:W});doc.fillColor(hex(C.azul)).fontSize(10).text('digsa.es',0,H*.5+40,{align:'center',width:W});}

function kpi(doc,x,y,w,h,label,valor,color){doc.rect(x,y,w,h).fill(hex(C.gris1));doc.rect(x,y,w,3).fill(hex(color||C.header));doc.fillColor(hex(C.subtxt)).font('Helvetica').fontSize(6.5).text(label.toUpperCase(),x+8,y+8,{width:w-16,characterSpacing:.3});doc.fillColor(hex(color||C.negro)).font('Helvetica-Bold').fontSize(13).text(valor,x+8,y+19,{width:w-16});}

function section(doc,y,t){doc.rect(MAR,y,CW,18).fill(hex(C.header));doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(7.5).text(t.toUpperCase(),MAR+8,y+5,{characterSpacing:.5});return y+18;}

function thead(doc,y,cols){
  doc.rect(MAR,y,CW,16).fill([42,42,42]);
  let x=MAR;
  cols.forEach(c=>{doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(7).text(c.l,x+2,y+4,{width:c.w-4,align:c.a||'left'});x+=c.w;});
  return y+16;
}

function trow(doc,y,cols,vals,bg,colors){
  const rh=16;
  if(bg)doc.rect(MAR,y,CW,rh).fill(hex(bg));
  doc.moveTo(MAR,y+rh).lineTo(MAR+CW,y+rh).strokeColor(hex(C.gris2)).lineWidth(.3).stroke();
  let x=MAR;
  cols.forEach((c,i)=>{
    const v=vals[i]!==undefined?String(vals[i]):'—';
    const col=colors&&colors[i]?colors[i]:C.negro;
    doc.fillColor(hex(col)).font(c.b?'Helvetica-Bold':'Helvetica').fontSize(7.5).text(v,x+2,y+4,{width:c.w-4,align:c.a||'left'});
    x+=c.w;
  });
  return y+rh;
}

function newPage(doc,tipo,nombre,fecha){doc.rect(0,0,W,H).fill(hex(C.blanco));iHeader(doc,tipo,nombre,fecha);return 128;}

async function generarPDFLiquidacion(data){
  const{usuario,fecha,liquidaciones,total_aporte,total_retorno,total_utilidad}=data;
  const nombre=`${usuario.nombre} ${usuario.apellido}`;
  // Una página por piso + portada + gracias
  const TOTAL=1+liquidaciones.length+1;
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({margin:0,size:'A4'});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    let pg=1;

    portada(doc,'Liquidación de Inversión',nombre,usuario.email,fecha,[
      {label:'Total aportado',valor:fE(total_aporte),color:C.blanco},
      {label:'Total retorno',valor:fE(total_retorno),color:C.verde},
      {label:'Utilidad neta',valor:fE(total_utilidad),color:C.naranja},
    ]);
    footer(doc,pg,TOTAL);

    // Una página detallada por piso (igual que el manual)
    for(const l of liquidaciones){
      doc.addPage();pg++;
      doc.rect(0,0,W,H).fill(hex(C.blanco));
      iHeader(doc,'LIQUIDACIÓN DE INVERSIÓN',nombre,fecha);
      let y=140;

      // Título del piso
      doc.rect(MAR,y,CW,28).fill(hex(C.header));
      doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(13)
         .text(l.piso.toUpperCase(),MAR+12,y+7,{width:CW-24});
      y+=38;

      // Filas de detalle
      const rows=[
        ['Fecha de venta', l.fecha_venta||fecha],
        ['Inversión total del piso', fE(l.precio_venta_piso||0)],
        ['Participación', l.porcentaje?(l.porcentaje*100).toFixed(2)+'%':'—'],
        ['Aporte del inversor', fE(l.aporte)],
        ['Utilidad bruta', fE(l.utilidad_bruta)],
        ['Fee de éxito (15%)', '-'+fE(l.fee)],
        ['Impuestos (25%)', '-'+fE(l.impuestos)],
        ['Rentabilidad neta', fE(l.util_neta)],
        ['Rentabilidad anual', l.tir_anual?'+'+l.tir_anual.toFixed(2)+'%':'—'],
      ];

      rows.forEach((row,i)=>{
        const bg=i%2===0?C.gris1:C.blanco;
        doc.rect(MAR,y,CW,24).fill(hex(bg));
        doc.fillColor(hex(C.subtxt)).font('Helvetica').fontSize(9)
           .text(row[0],MAR+12,y+7);
        const isNeg=String(row[1]).startsWith('-');
        doc.fillColor(hex(isNeg?C.naranja:C.negro)).font('Helvetica-Bold').fontSize(9)
           .text(String(row[1]),MAR+12,y+7,{width:CW-24,align:'right'});
        y+=24;
      });

      // Caja final — Liquidación total
      y+=10;
      doc.rect(MAR,y,CW,44).fill(hex(C.header));
      doc.fillColor(hex(C.blanco)).font('Helvetica').fontSize(10)
         .text('LIQUIDACIÓN TOTAL',MAR+12,y+8,{width:CW-24});
      doc.fillColor(hex(C.verde)).font('Helvetica-Bold').fontSize(18)
         .text(fE(l.total),MAR+12,y+20,{width:CW-24,align:'right'});

      footer(doc,pg,TOTAL);
    }

    doc.addPage();pg++;gracias(doc,usuario.nombre);footer(doc,pg,TOTAL);
    doc.end();
  });
}

async function generarPDFReporte(data){
  const{usuario,fecha,inversion_inicial,valor_actual,rentabilidad_total,tir,pisos_activos,inversiones_finalizadas,aportes,pendiente}=data;
  const nombre=`${usuario.nombre} ${usuario.apellido}`;
  const TOTAL=1+Math.max(1,Math.ceil((inversiones_finalizadas.length+aportes.length+10)/20))+1;
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({margin:0,size:'A4'});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
    let pg=1;
    portada(doc,'Reporte de Inversión',nombre,usuario.email,fecha,[
      {label:'Inversión inicial',valor:fE(inversion_inicial),color:C.blanco},
      {label:'Valor actual',valor:fE(valor_actual),color:C.verde},
      {label:'Rentabilidad',valor:fP(rentabilidad_total),color:C.naranja},
      {label:'TIR anualizada',valor:fP(tir||0),color:C.azul},
    ]);
    footer(doc,pg,TOTAL);

    // Columnas
    const CA=[{l:'Inmueble',w:140},{l:'Costo est.',w:75,a:'right'},{l:'Venta est.',w:75,a:'right'},{l:'Aporte',w:65,a:'right'},{l:'Neto est.',w:75,a:'right'},{l:'Rent.',w:85,a:'right'}];
    const CAC=[null,null,null,null,C.verde,C.naranja];
    const CAP=[{l:'Fecha',w:85},{l:'USD',w:75,a:'right'},{l:'EUR',w:75,a:'right'},{l:'Descripción',w:280}];
    const CF=[{l:'Inmueble',w:120},{l:'Inversión',w:65,a:'right'},{l:'Venta',w:65,a:'right'},{l:'Aporte',w:60,a:'right'},{l:'Liquidación',w:65,a:'right'},{l:'Rent.',w:45,a:'right'},{l:'Destino',w:95}];
    const CFC=[null,null,null,null,C.verde,C.naranja,null];

    doc.addPage();pg++;
    let y=newPage(doc,'REPORTE DE INVERSIÓN',nombre,fecha);

    // KPIs
    const kw4=(CW-30)/4;
    kpi(doc,MAR,y,kw4,55,'Inversión inicial',fE(inversion_inicial),C.negro);
    kpi(doc,MAR+kw4+10,y,kw4,55,'Valor actual',fE(valor_actual),C.verde);
    kpi(doc,MAR+kw4*2+20,y,kw4,55,'Rentabilidad',fP(rentabilidad_total),C.naranja);
    kpi(doc,MAR+kw4*3+30,y,kw4,55,'TIR anualizada',fP(tir||0),C.azul);
    y+=68;

    const chk=()=>{if(y>H-55){footer(doc,pg,TOTAL);doc.addPage();pg++;y=newPage(doc,'REPORTE DE INVERSIÓN',nombre,fecha);}};

    if(pisos_activos.length>0){
      chk();y=section(doc,y,`Pisos en cartera (${pisos_activos.length})`);
      y=thead(doc,y,CA);
      pisos_activos.forEach((p,i)=>{chk();y=trow(doc,y,CA,[p.nombre,fE(p.costo),fE(p.venta_est),fE(p.aporte),fE(p.neto_est),fP(p.rent)],i%2===0?C.gris1:C.blanco,CAC);});
      y+=8;
    }

    if(pendiente>0){
      chk();
      doc.rect(MAR,y,CW,20).fill('#FFF5F0');doc.rect(MAR,y,3,20).fill(hex(C.naranja));
      doc.fillColor(hex(C.naranja)).font('Helvetica-Bold').fontSize(8).text('PENDIENTE DE INVERSIÓN',MAR+8,y+6,{continued:true});
      doc.fillColor(hex(C.negro)).font('Helvetica').text(`   ${fE(pendiente)}`);y+=26;
    }

    chk();y=section(doc,y,`Aportes y retiros (${aportes.length})`);
    y=thead(doc,y,CAP);
    aportes.forEach((a,i)=>{
      chk();
      const c=a.tipo==='retiro'?C.naranja:C.negro;
      y=trow(doc,y,CAP,[fD(a.fecha),a.usd?fE(a.usd):'—',fE(a.eur),a.descripcion||'—'],i%2===0?C.gris1:C.blanco,[c,c,c,c]);
    });
    y+=10;

    chk();y=section(doc,y,`Inversiones finalizadas (${inversiones_finalizadas.length})`);
    y=thead(doc,y,CF);
    let totAp=0,totLiq=0;
    inversiones_finalizadas.forEach((f,i)=>{
      chk();totAp+=Number(f.aporte||0);totLiq+=Number(f.liquidacion||0);
      y=trow(doc,y,CF,[f.piso,fE(f.inversion),fE(f.venta),fE(f.aporte),fE(f.liquidacion),fP(f.rent),f.destino||'—'],i%2===0?C.gris1:C.blanco,CFC);
    });

    // Total finalizadas
    doc.rect(MAR,y,CW,17).fill(hex(C.header));
    let tx=MAR;
    [{t:'TOTAL',w:120},{t:'',w:65},{t:'',w:65},{t:fE(totAp),w:60,a:'right'},{t:fE(totLiq),w:65,a:'right'},{t:'',w:45},{t:'',w:95}].forEach(c=>{
      doc.fillColor(hex(C.blanco)).font('Helvetica-Bold').fontSize(7.5).text(c.t,tx+2,y+4,{width:c.w-4,align:c.a||'left'});tx+=c.w;
    });
    y+=19;

    footer(doc,pg,TOTAL);
    doc.addPage();pg++;gracias(doc,usuario.nombre);footer(doc,pg,TOTAL);
    doc.end();
  });
}

module.exports={generarPDFLiquidacion,generarPDFReporte};
