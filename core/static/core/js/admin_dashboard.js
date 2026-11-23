// Admin reporting UI only. Replace sampleOrders with backend-provided records.
// S16 payments; S22 refunds; S23 daily/weekly sales; S24 comparisons;
// S25 item rankings; S26 server sales; S27 hourly/day-of-week sales.
(() => {
    const root = document.querySelector('#admin-reports');
    if (!root) return;
    const content = document.querySelector('#report-content');
    const status = document.querySelector('#report-status');
    const from = document.querySelector('#report-from');
    const to = document.querySelector('#report-to');
    const period = document.querySelector('#report-period');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const shift = (date, days) => { const next = new Date(date); next.setDate(next.getDate()+days); return next; };
    const monday = date => shift(date, -((date.getDay()+6)%7));
    const cash = cents => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents/100);
    const menu = [ ['Margherita pizza',1400], ['Pepperoni pizza',1600], ['Garden pizza',1550], ['House salad',700], ['Garlic bread',600], ['Lemonade',350] ];
    const servers = ['Sample server A','Sample server B','Sample server C'];
    const sampleOrders = [];
    for (let day=0; day<35; day++) {
        for (let i=0; i<4; i++) {
            const date = iso(shift(today,-day));
            const items = [{id:(day+i)%6, quantity:1+(day+i)%3}, {id:5, quantity:2}];
            const amount = items.reduce((sum,item)=>sum+menu[item.id][1]*item.quantity,0);
            const closed = !(day===0 && i===3);
            sampleOrders.push({id:1000+day*4+i, date, hour:11+i*3, server:servers[(day+i)%3], items, amount, closed,
                payment:closed ? {method:i%2?'card':'cash', amount, timestamp:`${date} ${11+i*3}:30`} : null, refund:null});
        }
    }
    let active = 'sales';
    let action = null;
    const dialog = document.querySelector('#report-action');
    const node = (tag,text,className) => { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; if(className) el.className=className; return el; };
    const sum = rows => rows.reduce((total,row)=>total+row.amount-(row.refund?.amount||0),0);
    const range = () => sampleOrders.filter(row=>row.date>=from.value && row.date<=to.value);
    const closed = () => range().filter(row=>row.closed);
    function table(title, headers, rows) {
        const section=node('section',undefined,'table-card report-section');
        section.append(node('h3',title));
        const scroll=node('div',undefined,'report-scroll'); scroll.tabIndex=0; scroll.setAttribute('role','region'); scroll.setAttribute('aria-label',title);
        const grid=node('table'); const head=node('thead'); const hr=node('tr');
        headers.forEach(label=>{const cell=node('th',label);cell.scope='col';hr.append(cell);}); head.append(hr);grid.append(head);
        const body=node('tbody');
        rows.forEach(values=>{const tr=node('tr'); values.forEach(value=>{const td=node('td'); if(value instanceof Node) td.append(value);else td.textContent=value;tr.append(td);});body.append(tr);});
        if(!rows.length) {const tr=node('tr');const td=node('td','No records for this period.');td.colSpan=headers.length;tr.append(td);body.append(tr);}
        grid.append(body);scroll.append(grid);section.append(scroll);content.append(section);
    }
    function metrics(values) {
        const group=node('div',undefined,'report-metrics');
        values.forEach(([label,value])=>{const card=node('article',undefined,'table-card');card.append(node('h3',label),node('strong',value));group.append(card);});content.append(group);
    }
    function groups(rows, key) {
        const result=new Map();rows.forEach(row=>{const k=key(row);if(!result.has(k))result.set(k,[]);result.get(k).push(row);});return result;
    }
    function openAction(row, type) {
        action={row,type};
        document.querySelector('#report-action-title').textContent=type==='refund'?'Refund order (preview)':'Record payment (preview)';
        document.querySelector('#report-action-description').textContent=`Sample order #${row.id} - ${cash(row.amount)}. ${type==='refund'?'Full refund of this closed order.':'Record a cash or card payment.'}`;
        document.querySelector('#payment-fields').hidden=type==='refund';
        document.querySelector('#report-amount').disabled=type==='refund';
        document.querySelector('#report-amount').value=(row.amount/100).toFixed(2);
        document.querySelector('#report-method').value='cash';
        dialog.showModal();
    }
    function render() {
        content.replaceChildren();
        const headings={sales:'Sales totals',menu:'Top and bottom menu sellers',staff:'Sales per server',staffing:'Sales by hour and day',payments:'Payments and refunds'};
        const heading=node('h2',headings[active]);heading.id='report-section-title';content.append(heading);
        const rows=closed();
        if(active==='sales') {
            metrics([['Net food sales',cash(sum(rows))],['Closed orders',String(rows.length)],['Refunds',cash(rows.reduce((n,r)=>n+(r.refund?.amount||0),0))]]);
            content.append(node('p','Closed orders only. Net food sales subtract preview refunds and exclude tips and card fees.','report-note'));
            table('Daily sales',['Date','Orders','Net food sales'], [...groups(rows,r=>r.date)].sort().map(([day,list])=>[day,list.length,cash(sum(list))]));
            table('Weekly sales in selected period',['Week starting Monday','Orders','Net food sales'], [...groups(rows,r=>iso(monday(new Date(r.date+'T12:00:00'))))].sort().map(([week,list])=>[week,list.length,cash(sum(list))]));
            const weeks=[];
            for(let i=0;i<4;i++) {
                const start=shift(monday(today),-7*i), end=shift(start,(today.getDay()+6)%7);
                const list=sampleOrders.filter(r=>r.closed && r.date>=iso(start) && r.date<=iso(end));
                weeks.push([i===0?'This week':`${i} week(s) ago`,`${iso(start)} to ${iso(end)}`,cash(sum(list))]);
            }
            table('This week vs previous weeks (same weekdays; independent of date filter)',['Week','Dates','Net food sales'],weeks);
        } else if(active==='menu') {
            const counts=menu.map(([name],id)=>({name,quantity:rows.filter(r=>!r.refund).reduce((n,r)=>n+r.items.filter(item=>item.id===id).reduce((s,item)=>s+item.quantity,0),0)}));
            const ranked=[...counts].sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name));
            table('Top sellers',['Rank','Menu item','Quantity sold'],rows.length?ranked.slice(0,3).map((r,i)=>[i+1,r.name,r.quantity]):[]);
            table('Bottom sellers',['Rank','Menu item','Quantity sold'],rows.length?[...ranked].reverse().slice(0,3).map((r,i)=>[i+1,r.name,r.quantity]):[]);
            content.append(node('p','Quantities exclude fully refunded sample orders.','report-note'));
        } else if(active==='staff') {
            table('Server performance',['Server','Closed orders','Net food sales'],[...groups(rows,r=>r.server)].sort((a,b)=>sum(b[1])-sum(a[1])).map(([name,list])=>[name,list.length,cash(sum(list))]));
        } else if(active==='staffing') {
            table('Sales by hour',['Hour','Closed orders','Net food sales'],Array.from({length:24},(_,hour)=>{const list=rows.filter(r=>r.hour===hour);return [`${String(hour).padStart(2,'0')}:00`,list.length,cash(sum(list))];}));
            table('Sales by day of week',['Day','Closed orders','Net food sales'],['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i)=>{const list=rows.filter(r=>(new Date(r.date+'T12:00:00').getDay()+6)%7===i);return [day,list.length,cash(sum(list))];}));
        } else {
            table('Sample orders',['Order','Status','Method','Payment amount','Recorded at','Action'],range().map(row=>{
                let control;
                if(row.refund) control=node('span','Refunded');
                else { control=node('button',row.closed?'Refund':'Record payment');control.type='button';control.addEventListener('click',()=>openAction(row,row.closed?'refund':'payment')); }
                return [`#${row.id}`,row.closed?'Closed':'Open',row.payment?.method||'Not recorded',row.payment?cash(row.payment.amount):'—',row.payment?.timestamp||'—',control];
            }));
            content.append(node('p','Only closed orders offer a refund. Recording a payment here does not close an open order.','report-note'));
            table('Preview refund records',['Order','Amount','Timestamp'],sampleOrders.filter(r=>r.refund && r.date>=from.value && r.date<=to.value).map(r=>[`#${r.id}`,cash(r.refund.amount),r.refund.timestamp]));
        }
    }
    function setPeriod() {
        const value=period.value;if(value==='custom')return;
        let start=today,end=today;
        if(value==='week')start=monday(today);
        if(value==='previous'){start=shift(monday(today),-7);end=shift(start,6);}
        if(value==='all')start=shift(today,-27);
        from.value=iso(start);to.value=iso(end);render();
        status.textContent=`Showing sample records from ${from.value} to ${to.value}.`;
    }
    document.querySelectorAll('[data-report]').forEach(button=>button.addEventListener('click',()=>{
        active=button.dataset.report;document.querySelectorAll('[data-report]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));render();
    }));
    period.addEventListener('change',setPeriod);
    [from,to].forEach(input=>input.addEventListener('input',()=>{period.value='custom';}));
    document.querySelector('#report-filters').addEventListener('submit',event=>{event.preventDefault();if(from.value>to.value){status.textContent='Choose an end date on or after the start date.';return;}render();status.textContent=`Showing sample records from ${from.value} to ${to.value}.`;});
    document.querySelector('#report-action-cancel').addEventListener('click',()=>dialog.close());
    document.querySelector('#report-action-form').addEventListener('submit',event=>{
        event.preventDefault();if(!action)return;const {row,type}=action;
        if(type==='refund'){if(!row.closed||row.refund)return;row.refund={amount:row.amount,timestamp:new Date().toLocaleString()};}
        else {const amount=document.querySelector('#report-amount').valueAsNumber;if(!Number.isFinite(amount)||amount<=0)return;row.payment={method:document.querySelector('#report-method').value,amount:Math.round(amount*100),timestamp:new Date().toLocaleString()};}
        dialog.close();render();status.textContent=`Preview ${type} recorded for sample order #${row.id}. Nothing was saved to the database.`;
    });
    function route() {const show=location.hash==='#admin-reports';root.hidden=!show;document.querySelector('#server-floor').hidden=show;}
    window.addEventListener('hashchange',route);setPeriod();route();
})();
