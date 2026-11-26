/* Safe HelloEarth classroom workbook Markdown renderer. Never parses raw HTML. */
function appendInline(parent,input){
 const text=String(input||""),re=/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
 let start=0;
 for(const m of text.matchAll(re)){
  if(m.index>start)parent.append(document.createTextNode(text.slice(start,m.index)));
  const bold=m[0].startsWith("**");
  const child=document.createElement(bold?"strong":"em");
  child.textContent=m[0].slice(bold?2:1,bold?-2:-1);
  parent.append(child);start=m.index+m[0].length;
 }
 if(start<text.length)parent.append(document.createTextNode(text.slice(start)));
}
const rowCells=line=>String(line).trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(x=>x.trim());
const isSeparator=line=>/^\s*\|?\s*[:\-]{3,}(?:\s*\|\s*[:\-]{3,})+\s*\|?\s*$/.test(line||"");
const isHeader=line=>/^\s{0,3}#{1,6}\s/.test(line||"");
const isBullet=line=>/^\s{0,4}[-*]\s+\S/.test(line||"");
const isNumber=line=>/^\s{0,4}\d+[.)]\s+\S/.test(line||"");
const isRule=line=>/^\s*(?:---+|\*\*\*+)\s*$/.test(line||"");
const isQuote=line=>/^\s*>\s?/.test(line||"");
export function renderWorkbook(target,markdown){
 target.replaceChildren();
 const lines=String(markdown||"").replace(/\r\n?/g,"\n").slice(0,100000).split("\n");
 let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue}
  if(line.trim().startsWith("~~~")){
   const pre=document.createElement("pre"),contents=[];i++;
   while(i<lines.length&&!lines[i].trim().startsWith("~~~"))contents.push(lines[i++]);
   if(i<lines.length)i++;pre.textContent=contents.join("\n");target.append(pre);continue;
  }
  if(isRule(line)){target.append(document.createElement("hr"));i++;continue}
  if(isHeader(line)){
   const match=line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
   const heading=document.createElement("h"+Math.min(4,match[1].length));
   appendInline(heading,match[2]);target.append(heading);i++;continue;
  }
  if(line.includes("|")&&i+1<lines.length&&isSeparator(lines[i+1])){
   const headers=rowCells(line),table=document.createElement("table"),
    thead=document.createElement("thead"),theadrow=document.createElement("tr");
   for(const h of headers){const th=document.createElement("th");appendInline(th,h);theadrow.append(th)}
   thead.append(theadrow);table.append(thead);
   i+=2;const body=document.createElement("tbody");
   while(i<lines.length&&lines[i].includes("|")&&lines[i].trim()){
    const tr=document.createElement("tr"),cells=rowCells(lines[i]);
    for(let c=0;c<headers.length;c++){
     const td=document.createElement("td");appendInline(td,cells[c]||"");tr.append(td);
    }
    body.append(tr);i++;
   }
   table.append(body);const wrap=document.createElement("div");wrap.className="workbook-table-wrap";
   wrap.append(table);target.append(wrap);continue;
  }
  if(isBullet(line)||isNumber(line)){
   const ordered=isNumber(line),list=document.createElement(ordered?"ol":"ul");
   while(i<lines.length&&(ordered?isNumber(lines[i]):isBullet(lines[i]))){
    const li=document.createElement("li");
    appendInline(li,lines[i].replace(ordered?/^\s{0,4}\d+[.)]\s+/:/^\s{0,4}[-*]\s+/,""));
    list.append(li);i++;
   }
   target.append(list);continue;
  }
  if(isQuote(line)){
   const quote=document.createElement("blockquote");
   while(i<lines.length&&isQuote(lines[i])){
    const p=document.createElement("p");
    appendInline(p,lines[i].replace(/^\s*>\s?/,""));quote.append(p);i++;
   }
   target.append(quote);continue;
  }
  const paragraph=[];
  while(i<lines.length&&lines[i].trim()&&!isHeader(lines[i])&&!isBullet(lines[i])&&!isNumber(lines[i])&&!isRule(lines[i])&&!isQuote(lines[i])&&!lines[i].trim().startsWith("~~~")){
   if(lines[i].includes("|")&&i+1<lines.length&&isSeparator(lines[i+1]))break;
   paragraph.push(lines[i]);i++;
  }
  if(paragraph.length){
   const p=document.createElement("p");
   if(paragraph.join(" ").startsWith("**Level:**"))p.className="workbook-meta";
   appendInline(p,paragraph.join(" "));target.append(p);
  }else{i++}
 }
 if(!target.childNodes.length){
  const p=document.createElement("p");p.textContent="No lesson content yet.";target.append(p);
 }
}
