/* Shared translation fallback and word/sentence translator. No automatic cloud requests. */
(()=>{
 if(window.HelloEarthTranslate)return;
 const choices=[["en","English"],["af","Afrikaans"],["es","Español"],["pt","Português"],["fr","Français"],["pl","Polski"],["ru","Русский"],["zh","简体中文"],["tr","Türkçe"],["vi","Tiếng Việt"],["de","Deutsch"],["ar","العربية"],["he","עברית"],["it","Italiano"],["ja","日本語"],["ko","한국어"],["uk","Українська"],["nl","Nederlands"],["id","Bahasa Indonesia"]];
 const supported=new Set(choices.map(x=>x[0]));
 const phrases=[
 ["Chat","Klets","Chat","Chat","Discussion","Czat","Чат","聊天","Sohbet","Trò chuyện","Chat","دردشة","צ׳אט"],
 ["Close chat","Sluit klets","Cerrar chat","Fechar chat","Fermer la discussion","Zamknij czat","Закрыть чат","关闭聊天","Sohbeti kapat","Đóng trò chuyện","Chat schließen","إغلاق الدردشة","סגור צ׳אט"],
 ["Classroom chat","Klaskamerklets","Chat de clase","Chat da aula","Discussion de classe","Czat lekcji","Чат урока","课堂聊天","Ders sohbeti","Trò chuyện lớp học","Unterrichtschat","دردشة الصف","צ׳אט כיתתי"],
 ["Send","Stuur","Enviar","Enviar","Envoyer","Wyślij","Отправить","发送","Gönder","Gửi","Senden","إرسال","שלח"],
 ["Close","Sluit","Cerrar","Fechar","Fermer","Zamknij","Закрыть","关闭","Kapat","Đóng","Schließen","إغلاق","סגור"],
 ["More","Meer","Más","Mais","Plus","Więcej","Ещё","更多","Daha fazla","Thêm","Mehr","المزيد","עוד"],
 ["Copy link","Kopieer skakel","Copiar enlace","Copiar link","Copier le lien","Kopiuj link","Копировать ссылку","复制链接","Bağlantıyı kopyala","Sao chép liên kết","Link kopieren","نسخ الرابط","העתק קישור"],
 ["Follow scroll","Volg blaai","Seguir desplazamiento","Seguir rolagem","Suivre le défilement","Śledź przewijanie","Следовать прокрутке","跟随滚动","Kaydırmayı izle","Theo dõi cuộn","Scrollen folgen","متابعة التمرير","עקוב אחר גלילה"],
 ["Follow zoom","Volg zoem","Seguir zoom","Seguir zoom","Suivre le zoom","Śledź powiększenie","Следовать масштабу","跟随缩放","Yakınlaştırmayı izle","Theo dõi thu phóng","Zoom folgen","متابعة التكبير","עקוב אחר זום"],
 ["Sync scroll","Sinkroniseer blaai","Sincronizar desplazamiento","Sincronizar rolagem","Synchroniser le défilement","Synchronizuj przewijanie","Синхронизировать прокрутку","同步滚动","Kaydırmayı eşitle","Đồng bộ cuộn","Scrollen synchronisieren","مزامنة التمرير","סנכרן גלילה"],
 ["Sync zoom","Sinkroniseer zoem","Sincronizar zoom","Sincronizar zoom","Synchroniser le zoom","Synchronizuj powiększenie","Синхронизировать масштаб","同步缩放","Yakınlaştırmayı eşitle","Đồng bộ thu phóng","Zoom synchronisieren","مزامنة التكبير","סנכרן זום"],
 ["Draw","Teken","Dibujar","Desenhar","Dessiner","Rysuj","Рисовать","绘画","Çiz","Vẽ","Zeichnen","رسم","צייר"],
 ["Marker","Merkpen","Marcador","Marcador","Surligneur","Zakreślacz","Маркер","荧光笔","İşaretleyici","Bút đánh dấu","Textmarker","قلم تمييز","מרקר"],
 ["Text","Teks","Texto","Texto","Texte","Tekst","Текст","文本","Metin","Văn bản","Text","نص","טקסט"],
 ["Style","Styl","Estilo","Estilo","Style","Styl","Стиль","样式","Stil","Kiểu","Stil","النمط","סגנון"],
 ["Clear","Maak skoon","Borrar","Limpar","Effacer","Wyczyść","Очистить","清除","Temizle","Xóa","Löschen","مسح","נקה"],
 ["Ink","Ink","Tinta","Tinta","Encre","Tusz","Чернила","墨水","Mürekkep","Mực","Tinte","حبر","דיו"],
 ["Show pointer","Wys wyser","Mostrar puntero","Mostrar ponteiro","Afficher le pointeur","Pokaż wskaźnik","Показать указатель","显示指针","İşaretçiyi göster","Hiện con trỏ","Zeiger anzeigen","إظهار المؤشر","הצג מצביע"],
 ["Add photo","Voeg foto by","Añadir foto","Adicionar foto","Ajouter une photo","Dodaj zdjęcie","Добавить фото","添加照片","Fotoğraf ekle","Thêm ảnh","Foto hinzufügen","إضافة صورة","הוסף תמונה"],
 ["Change photo","Verander foto","Cambiar foto","Alterar foto","Changer la photo","Zmień zdjęcie","Изменить фото","更换照片","Fotoğrafı değiştir","Đổi ảnh","Foto ändern","تغيير الصورة","שנה תמונה"],
 ["Remove photo","Verwyder foto","Eliminar foto","Remover foto","Supprimer la photo","Usuń zdjęcie","Удалить фото","移除照片","Fotoğrafı kaldır","Xóa ảnh","Foto entfernen","إزالة الصورة","הסר תמונה"],
 ["Private source archive","Private bronargief","Archivo privado de fuentes","Arquivo privado de fontes","Archives privées","Prywatne archiwum źródeł","Личный архив источников","私人源文件归档","Özel kaynak arşivi","Kho lưu trữ riêng","Privates Quellenarchiv","أرشيف المصادر الخاص","ארכיון מקורות פרטי"],
 ["Translate to","Vertaal na","Traducir a","Traduzir para","Traduire vers","Przetłumacz na","Перевести на","翻译为","Şu dile çevir","Dịch sang","Übersetzen in","ترجمة إلى","תרגם ל"],
 ["Translation","Vertaling","Traducción","Tradução","Traduction","Tłumaczenie","Перевод","翻译","Çeviri","Bản dịch","Übersetzung","ترجمة","תרגום"],
 ["Languages & translation","Tale en vertaling","Idiomas y traducción","Idiomas e tradução","Langues et traduction","Języki i tłumaczenie","Языки и перевод","语言与翻译","Diller ve çeviri","Ngôn ngữ và bản dịch","Sprachen und Übersetzung","اللغات والترجمة","שפות ותרגום"],
 ["Type a message…","Tik 'n boodskap…","Escribe un mensaje…","Digite uma mensagem…","Écrivez un message…","Napisz wiadomość…","Введите сообщение…","输入消息…","Mesaj yazın…","Nhập tin nhắn…","Nachricht eingeben…","اكتب رسالة…","הקלד הודעה…"],
 ["Download chat","Laai klets af","Descargar chat","Baixar chat","Télécharger la discussion","Pobierz czat","Скачать чат","下载聊天","Sohbeti indir","Tải cuộc trò chuyện","Chat herunterladen","تنزيل الدردشة","הורד צ׳אט"],
 ["Only you online","Net jy aanlyn","Solo tú en línea","Só você online","Vous seul en ligne","Tylko Ty online","Только вы онлайн","仅你在线","Yalnızca sen çevrimiçi","Chỉ bạn trực tuyến","Nur du online","أنت فقط متصل","רק אתה מחובר"],
 ["Connecting…","Koppel…","Conectando…","Conectando…","Connexion…","Łączenie…","Подключение…","正在连接…","Bağlanıyor…","Đang kết nối…","Verbindung…","جارٍ الاتصال…","מתחבר…"],
 ["Connection lost","Verbinding verloor","Conexión perdida","Conexão perdida","Connexion perdue","Utracono połączenie","Связь потеряна","连接丢失","Bağlantı kesildi","Mất kết nối","Verbindung verloren","انقطع الاتصال","החיבור נותק"],
 ["Student view","Leerderaansig","Vista del estudiante","Visão do aluno","Vue élève","Widok ucznia","Вид ученика","学生视图","Öğrenci görünümü","Chế độ học viên","Schüleransicht","عرض الطالب","תצוגת תלמיד"],
 ["Highlight intensity","Merkintensiteit","Intensidad del resaltado","Intensidade do destaque","Intensité du surlignage","Intensywność zakreślenia","Интенсивность выделения","高亮强度","Vurgu yoğunluğu","Cường độ tô sáng","Markierungsintensität","شدة التمييز","עוצמת ההדגשה"],
 ["Stroke thickness","Lyndikte","Grosor del trazo","Espessura do traço","Épaisseur du trait","Grubość linii","Толщина линии","笔画粗细","Çizgi kalınlığı","Độ dày nét","Strichstärke","سماكة الخط","עובי קו"],
 ["Reset style","Herstel styl","Restablecer estilo","Redefinir estilo","Réinitialiser le style","Resetuj styl","Сбросить стиль","重置样式","Stili sıfırla","Đặt lại kiểu","Stil zurücksetzen","إعادة ضبط النمط","אפס סגנון"],
 ["Apply text highlight","Pas teksmarkering toe","Aplicar resaltado de texto","Aplicar destaque ao texto","Surligner le texte","Zastosuj zakreślenie","Выделить текст","应用文本高亮","Metni vurgula","Áp dụng tô sáng","Text markieren","تمييز النص","הדגש טקסט"]
 ];
 const offline={};for(const row of phrases)for(let i=1;i<row.length;i++){(offline[choices[i][0]]??={})[row[0]]=row[i]}
 const cache=new Map(),pending=new Set(),translators=new Map();let enabled=new Set(),refreshTimer=0,worker=Promise.resolve(),status;try{for(const lang of JSON.parse(localStorage.getItem("helloearth-local-translation-languages")||"[]"))if(supported.has(lang))enabled.add(lang)}catch{}
 const normalize=s=>String(s||"").replace(/\s+/g," ").trim();
 function signal(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>document.dispatchEvent(new CustomEvent("helloearth:translationready")),120)}
 async function translator(from,to,download=false){
  if(from===to)return null;
  if(!window.Translator?.availability||!window.Translator?.create)throw Error("On-device translation is unavailable in this browser.");
  const key=from+":"+to;if(translators.has(key))return translators.get(key);
  const params={sourceLanguage:from,targetLanguage:to};
  const task=(async()=>{const state=await Translator.availability(params);if(state==="unavailable")throw Error("This language pair is unavailable on this device.");if(state!=="available"&&!download)throw Error("Download the language pack first.");return Translator.create(params)})();
  translators.set(key,task);try{return await task}catch(e){translators.delete(key);throw e}
 }
 function lookup(text,lang,allowMachine=true){
  const clean=normalize(text);if(!clean||lang==="en")return undefined;
  if(offline[lang]?.[clean])return offline[lang][clean];
  if(!allowMachine||!enabled.has(lang)||!/[A-Za-z]/.test(clean)||clean.length>1200||/^[\d\s.,:$/%+−-]+$/.test(clean))return undefined;
  const key=lang+"\n"+clean;if(cache.has(key))return cache.get(key)||undefined;
  if(pending.has(key)||pending.size>=300||cache.size>=2500)return undefined;
  pending.add(key);worker=worker.then(async()=>{try{const t=await translator("en",lang),result=String(await t.translate(clean)).trim();cache.set(key,result||"")}catch{cache.set(key,"")}finally{pending.delete(key);signal()}});
  return undefined;
 }
 function localizeOptions(select){for(const [code,label] of choices)if(!Array.from(select.options).some(o=>o.value===code)){const option=document.createElement("option");option.value=code;option.textContent=label;select.append(option)}}
 window.HelloEarthTranslate={choices,supported,lookup,localizeOptions};
 let dialog,input,output,source,target,enable,runButton,openButton;
 function element(tag,attrs={},text=""){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n}
 function picker(label){const group=element("label",{},label),select=element("select");localizeOptions(select);group.append(select);return [group,select]}
 function init(){
  const style=element("style");style.textContent=".he-translate-launch{border:1px solid #a99acb;background:#342a53;color:#fff;padding:6px 10px;border-radius:8px;font:600 12px system-ui;cursor:pointer}.he-translate-launch:hover{background:#52416f}.he-translate-dialog{width:min(480px,calc(100vw - 24px));max-height:85dvh;overflow:auto;border:1px solid #d5cbe7;border-radius:14px;background:#f8f6fc;color:#28233c;padding:18px;font:14px system-ui;box-shadow:0 20px 60px #0007}.he-translate-dialog::backdrop{background:#13132288}.he-translate-dialog h2{margin:0;font-size:19px}.he-translate-head,.he-translate-pairs,.he-translate-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between}.he-translate-pairs label{flex:1;min-width:100px;display:grid;gap:4px;font-size:12px}.he-translate-dialog textarea,.he-translate-dialog select{width:100%;box-sizing:border-box;padding:8px;border:1px solid #c9bedb;border-radius:8px;background:#fff;color:#28233c;font:inherit}.he-translate-dialog button{border:1px solid #8a73b2;background:#7253a5;color:white;border-radius:8px;padding:9px 12px;cursor:pointer;font:600 12px system-ui}.he-translate-dialog button:disabled{opacity:.5;cursor:default}.he-translate-dialog p{font-size:12px;line-height:1.5}.he-translate-output{white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#fff;border:1px solid #ded5e9;border-radius:8px;min-height:48px}.he-translate-dialog [hidden]{display:none!important}@media print{.he-translate-launch,.he-translate-dialog{display:none!important}}";
  document.head.append(style);
  openButton=element("button",{type:"button",class:"he-translate-launch",translate:"no"},"Translate");
  dialog=element("dialog",{class:"he-translate-dialog",translate:"no","aria-label":"Word and page translation"});
  const header=element("div",{class:"he-translate-head"}),close=element("button",{type:"button"},"Close");header.append(element("h2",{},"Translate any text"),close);
  const pair=element("div",{class:"he-translate-pairs"}),[sourceGroup,src]=picker("Original language"),[targetGroup,dst]=picker("Translate to");source=src;target=dst;pair.append(sourceGroup,targetGroup);
  input=element("textarea",{rows:"4",maxlength:"4000",placeholder:"Select text on this page, or paste a word or sentence.","aria-label":"Original text"});
  output=element("div",{class:"he-translate-output",role:"status","aria-live":"polite"},"Translation will appear here.");
  runButton=element("button",{type:"button"},"Translate text");enable=element("button",{type:"button"},"Enable automatic page translation");
  status=element("p",{role:"status"});
  const actions=element("div",{class:"he-translate-actions"});actions.append(runButton,enable);
  dialog.append(header,element("p",{},"Translate selected words or sentences without changing the original lesson or student records."),pair,input,actions,status,output,element("p",{},"On-device translation requires a supported browser and language pack. If it is unavailable, use your browser's page translation for non-private pages. Translation may be inaccurate."));
  document.body.append(dialog);
  const host=document.querySelector(".share-toolbar-actions,.lesson-toolbar-actions,.auth-top,.ws-sidebar,.pricing-header,.site-header .header-inner,body>header");
  (host||document.body).append(openButton);
  let selected="";document.addEventListener("selectionchange",()=>{if(dialog.open)return;const s=window.getSelection()?.toString().trim();if(s)selected=s.slice(0,4000)});
  openButton.addEventListener("click",()=>{const active=window.getSelection()?.toString().trim()||selected;input.value=active||"";selected="";source.value=document.documentElement.lang&&supported.has(document.documentElement.lang)?document.documentElement.lang:"en";target.value=source.value==="en"?(supported.has(localStorageSafe())?localStorageSafe():"es"):"en";if(target.value===source.value)target.value="es";output.textContent="Translation will appear here.";status.textContent="";dialog.showModal()});
  close.onclick=()=>dialog.close();
  runButton.onclick=async()=>{const text=input.value.trim(),from=source.value,to=target.value;if(!text){status.textContent="Select or type text first.";return}runButton.disabled=true;try{status.textContent="Preparing translation…";const t=await translator(from,to,true);output.textContent=t?await t.translate(text):text;status.textContent="Original text has not been changed."}catch(e){status.textContent=e.message;output.textContent="Translation unavailable."}finally{runButton.disabled=false}};
  enable.onclick=async()=>{const lang=target.value;if(lang==="en"){status.textContent="Choose a non-English language first.";return}enable.disabled=true;try{status.textContent="Preparing the language pack…";await translator("en",lang,true);enabled.add(lang);try{localStorage.setItem("helloearth-local-translation-languages",JSON.stringify([...enabled]))}catch{}for(const k of cache.keys())if(k.startsWith(lang+"\n")&&!cache.get(k))cache.delete(k);if(window.HelloEarthI18n)window.HelloEarthI18n.setLanguage(lang);else{const picker=document.getElementById("site-language");if(picker){picker.value=lang;picker.dispatchEvent(new Event("change"))}}signal();status.textContent="Automatic translation enabled for this page. Lesson text and private records stay unchanged; select text to translate them separately."}catch(e){status.textContent=e.message}finally{enable.disabled=false}};
 }
 function localStorageSafe(){try{return localStorage.getItem("helloearth-language")}catch{return null}}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
