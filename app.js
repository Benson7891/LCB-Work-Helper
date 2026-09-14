/* =========================================================================
   LCB Matter 总表 · 原型 v1
   -------------------------------------------------------------------------
   需求来源：《LCB 中墨法律协作团队 · Matter 总表（网页版）需求单 v1》
   数据保存在浏览器本地（localStorage），因此可以离线试用、随点随存。
   将来接后端时，只需把 storage 层的读写换成接口调用，界面不用改。
   ========================================================================= */

/* ------------------------------ 常量 ------------------------------ */

const KEY = {
  matters: 'lcb_matters_v1',
  logs: 'lcb_logs_v1',
  session: 'lcb_session_v1',
  seq: 'lcb_seq_v1',
  lang: 'lcb_lang_v1',
  systemSeen: 'lcb_system_notice_seen_v1',
  systemEnabled: 'lcb_system_notice_enabled_v1',
};

/* ------------------------------ 共享数据（Supabase） ------------------------------
   页面是纯静态的，所以要三个人共用一份数据，必须有个服务器那一侧。
   publishable key 设计成可以公开，配合数据库里的权限规则使用。 */
const SUPABASE = {
  url: 'https://tvavifjfbdwgkehtbxum.supabase.co',
  key: 'sb_publishable_xliQlMoVI_RIwz3OUnrJzw_imZivXbE',
};
const REMOTE_ENABLED = !!(SUPABASE.url && SUPABASE.key) && typeof fetch === 'function';
const SYNC_EVERY_MS = 15000;
const sync = {
  status: REMOTE_ENABLED ? 'loading' : 'off',  // loading | ok | error | off
  lastAt: 0,
  error: '',
  dirty: false,        // 本地有还没推上去的改动
  busy: false,
  retryCount: 0,
  retryTimer: null,
  syncedLogs: new Set(),
  purged: new Set(),   // 要彻底删掉的远端事项
};

/* ------------------------------ 界面语言 ------------------------------ */

const LANGS = [
  { id: 'zh', label: '中', name: '简体中文' },
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'es', label: 'ES', name: 'Español' },
];
const LANG_INDEX = { zh: 0, en: 1, es: 2 };

/* 每条： [简体中文, English, Español] */
const STR = {
  'app.title': ['LCB Matter 总表', 'LCB Matter Board', 'Tablero de Asuntos LCB'],
  'app.team': ['LCB 中墨法律协作团队', 'LCB China–Mexico Legal Collaboration', 'Colaboración legal LCB China–México'],

  'login.email': ['邮箱', 'Email', 'Correo electrónico'],
  'login.password': ['密码', 'Password', 'Contraseña'],
  'login.signin': ['登录', 'Sign in', 'Iniciar sesión'],
  'login.noSms': ['用邮箱 + 密码登录，不需要手机短信验证码——这样在墨西哥和美国的同事也能顺利进来。',
    'Sign in with email and password — no SMS codes, so colleagues in Mexico and the US get in without trouble.',
    'Inicia sesión con correo y contraseña, sin códigos SMS: así tus colegas de México y EE. UU. entran sin problema.'],
  'login.demoTitle': ['演示账号', 'Demo accounts', 'Cuentas de demostración'],
  'login.hint': ['用不同账号登录，可以看到权限差异：Héctor 登录后看不到任何制裁／涉美事项。',
    'Sign in with different accounts to see permissions at work: Héctor cannot see any sanctions / US matters.',
    'Entra con distintas cuentas para ver los permisos: Héctor no ve ningún asunto de sanciones ni de EE. UU.'],
  'login.errNoUser': ['没有找到这个邮箱对应的成员。', 'No team member matches that email.', 'No hay ningún miembro con ese correo.'],
  'login.errBadPass': ['密码不对，请重新输入。', 'Wrong password, please try again.', 'Contraseña incorrecta, inténtalo de nuevo.'],
  'toast.welcome': ['欢迎回来，{name}', 'Welcome back, {name}', 'Bienvenido de nuevo, {name}'],

  'nav.dashboard': ['首页', 'Home', 'Inicio'],
  'nav.matters': ['事项', 'Matters', 'Asuntos'],
  'nav.weekly': ['每周视图', 'Weekly', 'Semanal'],
  'nav.inbox': ['通知', 'Notifications', 'Notificaciones'],
  'nav.settings': ['信息', 'Info', 'Información'],
  'nav.trash': ['回收站', 'Recycle bin', 'Papelera'],
  'topbar.signout': ['退出登录', 'Sign out', 'Cerrar sesión'],
  'banner.noStorage': ['⚠️ 这个浏览器不允许网页在本机保存数据，所以你现在改的东西刷新后会丢。换成 GitHub Pages 网址打开，或者用 Chrome 打开这个文件就正常了。',
    '⚠️ This browser does not let the page save data locally, so your changes will be lost when you refresh. Open it from the GitHub Pages URL, or open the file in Chrome.',
    '⚠️ Este navegador no permite guardar datos localmente: los cambios se perderán al recargar. Ábrelo desde la URL de GitHub Pages o con Chrome.'],
  'sync.ok': ['已同步', 'Synced', 'Sincronizado'],
  'sync.loading': ['同步中…', 'Syncing…', 'Sincronizando…'],
  'sync.error': ['未同步', 'Not synced', 'Sin sincronizar'],
  'sync.failedClick': ['未同步，点这里！', 'Not synced — click here!', 'Sin sincronizar: ¡haz clic aquí!'],
  'sync.offline': ['离线：改动只留在这台设备', 'Offline: changes stay on this device', 'Sin conexión: los cambios quedan aquí'],
  'sync.tablesMissing': ['数据表还没建好，请在 Supabase 里执行建表脚本', 'The tables are missing — run the setup SQL in Supabase', 'Faltan las tablas: ejecuta el SQL de configuración en Supabase'],
  'sync.tipOk': ['三台设备共用同一份数据 · 最近同步 {time} · 点一下立刻刷新',
    'All devices share one dataset · last synced {time} · click to refresh now',
    'Todos los dispositivos comparten los datos · última sincronización {time} · haz clic para refrescar'],
  'sync.tipError': ['同步失败：{msg}。改动已存在本机，稍后会自动重试。',
    'Sync failed: {msg}. Your changes are saved locally and will retry.',
    'Error de sincronización: {msg}. Los cambios están guardados aquí y se reintentará.'],

  'dash.morning': ['早上好，{name}', 'Good morning, {name}', 'Buenos días, {name}'],
  'dash.afternoon': ['下午好，{name}', 'Good afternoon, {name}', 'Buenas tardes, {name}'],
  'dash.evening': ['晚上好，{name}', 'Good evening, {name}', 'Buenas noches, {name}'],
  'dash.desc': ['先看红色，再看今天要推进的。每件事都必须有人负责、有下一步、有截止日。',
    'Red first, then what needs pushing today. Every matter needs an owner, a next step and a due date.',
    'Primero lo rojo y luego lo que hay que empujar hoy. Cada asunto necesita responsable, próximo paso y fecha límite.'],
  'dash.new': ['＋ 新建事项', '＋ New matter', '＋ Nuevo asunto'],
  'dash.kpi.red': ['🔴 红色事项', '🔴 Red matters', '🔴 Asuntos rojos'],
  'dash.kpi.redFoot': ['需要立即处理', 'Needs immediate action', 'Requieren acción inmediata'],
  'dash.kpi.due': ['📅 本周到期', '📅 Due this week', '📅 Vencen esta semana'],
  'dash.kpi.dueFoot': ['7 天内截止', 'Due within 7 days', 'Vencen en 7 días'],
  'dash.kpi.mine': ['⏳ 等我推进', '⏳ Waiting on me', '⏳ Pendientes de mí'],
  'dash.kpi.mineFoot': ['我要做的事情', 'Things I need to do', 'Mis tareas'],
  'dash.kpi.visible': ['👀 我能看到', '👀 I can see', '👀 Puedo ver'],
  'dash.kpi.visibleAdmin': ['管理员 · 全部事项', 'Admin · all matters', 'Administradora · todos los asuntos'],
  'dash.kpi.visibleMember': ['仅我是项目成员的事项', 'Only matters I am assigned to', 'Solo asuntos en los que participo'],
  'dash.today': ['今天要处理的', 'To do today', 'Para hoy'],
  'dash.todayDesc': ['红色 + 黄色事项，按紧急程度排序。点任意一行可以打开详情。',
    'Red + yellow matters, most urgent first. Click any row to open it.',
    'Asuntos rojos y amarillos, los más urgentes primero. Haz clic en una fila para abrirla.'],
  'dash.empty': ['目前没有需要关注的事项 🎉', 'Nothing needs attention right now 🎉', 'Nada requiere atención por ahora 🎉'],
  'legend.green': ['🟢 正常推进', '🟢 On track', '🟢 En curso'],
  'legend.yellow': ['🟡 等待客户／第三方／有风险', '🟡 Waiting on client / third party / at risk', '🟡 Esperando al cliente o a terceros / en riesgo'],
  'legend.red': ['🔴 需要团队立即处理', '🔴 Team must act now', '🔴 El equipo debe actuar ya'],

  'list.title': ['事项', 'Matters', 'Asuntos'],
  'list.desc': ['共 {n} 条', '{n} matters', '{n} asuntos'],
  'list.descAdmin': ['（管理员，全部事项）', '(admin, all matters)', '(administradora, todos los asuntos)'],
  'list.descMember': ['（只含你是项目成员的事项）', '(only matters you are assigned to)', '(solo asuntos en los que participas)'],
  'list.export': ['导出CSV表格', 'Export CSV spreadsheet', 'Exportar tabla CSV'],
  'list.bulkDelete': ['批量删除', 'Bulk delete', 'Eliminar en lote'],
  'list.import': ['Excel/CSV导入', 'Import Excel/CSV', 'Importar Excel/CSV'],
  'modal.import.title': ['Excel/CSV导入事项', 'Import matters from Excel/CSV', 'Importar asuntos desde Excel/CSV'],
  'modal.import.hint': ['第一行必须是表头。支持：客户、事项名称、业务类型、当前阶段、状态、截止日期、等待谁、现在要做什么、负责人。', 'The first row must contain headers. Supported: client, matter name, practice area, stage, status, due date, waiting for, next step, owner.', 'La primera fila debe contener encabezados. Compatible con cliente, asunto, área, etapa, estado, fecha límite, espera, próximo paso y responsable.'],
  'modal.import.choose': ['选择 .xlsx 或 .csv 文件', 'Choose an .xlsx or .csv file', 'Elige un archivo .xlsx o .csv'],
  'modal.import.confirm': ['导入事项', 'Import matters', 'Importar asuntos'],
  'modal.import.result': ['已导入 {ok} 条，跳过 {bad} 条', 'Imported {ok}; skipped {bad}', 'Importados {ok}; omitidos {bad}'],
  'modal.import.invalid': ['格式不对，是否查看示例文件？', 'The format is incorrect. Would you like to view a sample file?', 'El formato no es correcto. ¿Quieres ver un archivo de ejemplo?'],
  'modal.import.yes': ['是', 'Yes', 'Sí'],
  'modal.import.no': ['否', 'No', 'No'],
  'modal.import.sample': ['示例文件', 'Sample file', 'Archivo de ejemplo'],
  'modal.export.title': ['导出CSV表格', 'Export CSV spreadsheet', 'Exportar tabla CSV'],
  'modal.export.body': ['CSV 表格可用 Excel 打开。', 'CSV spreadsheets can be opened in Excel.', 'Las tablas CSV se pueden abrir con Excel.'],
  'modal.export.confirm': ['下载CSV表格', 'Download CSV', 'Descargar CSV'],
  'list.search': ['搜索客户、事项、下一步…', 'Search client, matter, next step…', 'Buscar cliente, asunto, próximo paso…'],
  'list.allAreas': ['全部业务类型', 'All practice areas', 'Todas las áreas'],
  'list.allOwners': ['全部负责人', 'All owners', 'Todos los responsables'],
  'list.allStatus': ['全部状态', 'All statuses', 'Todos los estados'],
  'list.allWaiting': ['全部等待对象', 'Any waiting-on', 'Cualquier espera'],
  'list.clear': ['清除筛选', 'Clear filters', 'Limpiar filtros'],
  'list.empty': ['没有符合条件的事项。', 'No matters match these filters.', 'Ningún asunto coincide con los filtros.'],
  'th.no': ['编号', 'No.', 'Nº'],
  'th.client': ['客户', 'Client', 'Cliente'],
  'th.title': ['事项', 'Matter', 'Asunto'],
  'th.area': ['业务类型', 'Practice area', 'Área'],
  'th.owner': ['负责人', 'Owner', 'Responsable'],
  'th.status': ['状态', 'Status', 'Estado'],
  'th.next': ['当前步骤', 'Current step', 'Paso actual'],
  'th.due': ['截止', 'Due', 'Vence'],
  'th.waiting': ['等待谁', 'Waiting for', 'Esperando a'],
  'th.chat': ['聊天', 'Chat', 'Chat'],

  'inbox.title': ['通知', 'Notifications', 'Notificaciones'],
  'inbox.desc': ['事项成员的操作通知和聊天消息。每个账号的已读状态分别保存。',
    'Matter activity and chat messages for you. Read status is saved separately for each account.',
    'Actividad y mensajes de los asuntos para ti. El estado de lectura se guarda por separado para cada cuenta.'],
  'inbox.systemHint': ['开启后，新通知会同时弹出系统通知；需要保持网页打开，后台标签页也可以。',
    'Once enabled, new activity also appears as a system notification. Keep this site open; a background tab is fine.',
    'Al activarlas, la nueva actividad también aparecerá como notificación del sistema. Mantén el sitio abierto; puede estar en segundo plano.'],
  'inbox.systemEnable': ['开启系统通知', 'Enable system notifications', 'Activar notificaciones del sistema'],
  'inbox.systemRequesting': ['等待系统授权…', 'Waiting for permission…', 'Esperando autorización…'],
  'inbox.systemEnabled': ['系统通知已开启', 'System notifications enabled', 'Notificaciones del sistema activadas'],
  'inbox.systemDisable': ['关闭系统通知', 'Turn off system notifications', 'Desactivar notificaciones del sistema'],
  'inbox.systemUnsupported': ['此浏览器不支持系统通知', 'System notifications are not supported', 'Este navegador no admite notificaciones del sistema'],
  'system.title': ['LCB 新通知', 'New LCB notification', 'Nueva notificación de LCB'],
  'inbox.empty': ['还没有通知。', 'No notifications yet.', 'Todavía no hay notificaciones.'],
  'inbox.markRead': ['已读', 'Mark read', 'Marcar como leído'],
  'inbox.delete': ['删除消息', 'Delete message', 'Eliminar mensaje'],
  'inbox.read': ['已读', 'Read', 'Leído'],
  'inbox.unread': ['未读', 'Unread', 'No leído'],
  'inbox.new': ['{actor} 新建了事项“{title}”。当前步骤：“{next}”，由 {owner} 负责。当前事项状态：{status}。',
    '{actor} created “{title}”. Current step: “{next}”, assigned to {owner}. Current status: {status}.',
    '{actor} creó «{title}». Paso actual: «{next}», a cargo de {owner}. Estado actual: {status}.'],
  'inbox.edited': ['{actor} 修改了事项“{title}”。当前步骤：“{next}”，由 {owner} 负责。当前事项状态：{status}。',
    '{actor} updated “{title}”. Current step: “{next}”, assigned to {owner}. Current status: {status}.',
    '{actor} modificó «{title}». Paso actual: «{next}», a cargo de {owner}. Estado actual: {status}.'],
  'inbox.editUndo': ['{actor} 撤回了事项“{title}”的上次修改。当前步骤：“{next}”，由 {owner} 负责。当前事项状态：{status}。',
    '{actor} undid the last edit to “{title}”. Current step: “{next}”, assigned to {owner}. Current status: {status}.',
    '{actor} deshizo la última modificación de «{title}». Paso actual: «{next}», a cargo de {owner}. Estado actual: {status}.'],
  'inbox.deleted': ['{actor} 删除了事项“{title}”，事项已进入回收站。',
    '{actor} deleted “{title}”; it is now in the recycle bin.',
    '{actor} eliminó «{title}»; ahora está en la papelera.'],
  'inbox.restored': ['{actor} 从回收站恢复了事项“{title}”。',
    '{actor} restored “{title}” from the recycle bin.',
    '{actor} restauró «{title}» desde la papelera.'],
  'inbox.stepDone': ['{actor} 完成了事项“{title}”步骤“{step}”，下一步“{next}”由 {owner} 负责。当前事项状态：{status}。',
    '{actor} completed the “{step}” step in “{title}”. Next, “{next}” is assigned to {owner}. Current status: {status}.',
    '{actor} completó el paso «{step}» de «{title}». El siguiente paso, «{next}», está a cargo de {owner}. Estado actual: {status}.'],
  'inbox.stepUndo': ['{actor} 撤回了事项“{title}”的步骤完成记录，当前步骤回到“{step}”，由 {owner} 负责。',
    '{actor} undid a completed step in “{title}”. The current step is again “{step}”, assigned to {owner}.',
    '{actor} deshizo un paso completado de «{title}». El paso actual vuelve a ser «{step}», a cargo de {owner}.'],
  'inbox.fileAdd': ['{actor} 在事项“{title}”中添加了文件链接“{name}”。',
    '{actor} added the file link “{name}” to “{title}”.',
    '{actor} añadió el enlace «{name}» al asunto «{title}».'],
  'inbox.fileRemove': ['{actor} 从事项“{title}”中移除了文件链接“{name}”。',
    '{actor} removed the file link “{name}” from “{title}”.',
    '{actor} quitó el enlace «{name}» del asunto «{title}».'],
  'inbox.chat': ['{actor} 在事项“{title}”中发送消息：“{message}”',
    '{actor} sent a message in “{title}”: “{message}”',
    '{actor} envió un mensaje en «{title}»: «{message}»'],
  'inbox.readReceipt': ['{reader} 已读您的通知【{preview}】',
    '{reader} read your notification [{preview}]',
    '{reader} leyó su notificación [{preview}]'],

  'status.green': ['绿 · 正常', 'Green · On track', 'Verde · En curso'],
  'status.green.short': ['正常', 'On track', 'En curso'],
  'status.yellow': ['黄 · 关注', 'Yellow · Watch', 'Amarillo · Atención'],
  'status.yellow.short': ['关注', 'Watch', 'Atención'],
  'status.red': ['红 · 紧急', 'Red · Urgent', 'Rojo · Urgente'],
  'status.red.short': ['紧急', 'Urgent', 'Urgente'],

  'wait.none': ['—', '—', '—'],
  'wait.client': ['客户', 'Client', 'Cliente'],
  'wait.counterparty': ['对方律师', 'Opposing counsel', 'Contraparte'],
  'wait.authority': ['政府部门', 'Government authority', 'Autoridad'],
  'wait.notary': ['墨西哥公证', 'Mexican notary', 'Notaría (México)'],
  'wait.bank': ['银行', 'Bank', 'Banco'],
  'wait.ofac': ['OFAC', 'OFAC', 'OFAC'],
  'wait.tax': ['税务顾问', 'Tax adviser', 'Asesor fiscal'],
  'wait.carol': ['Carol', 'Carol', 'Carol'],
  'wait.carlos': ['Carlos Dávila', 'Carlos Dávila', 'Carlos Dávila'],
  'wait.hector': ['Héctor Luján Medina', 'Héctor Luján Medina', 'Héctor Luján Medina'],
  'wait.other': ['其他', 'Other', 'Otro'],

  'stage.engagement': ['立项委托', 'Engagement', 'Encargo'],
  'stage.consultation': ['咨询', 'Consultation', 'Consulta'],
  'stage.dd': ['尽职调查', 'Due diligence', 'Due diligence'],
  'stage.research': ['法律研究', 'Legal research', 'Investigación legal'],
  'stage.drafting': ['文件起草', 'Drafting', 'Redacción'],
  'stage.filing': ['申报递交', 'Filing / submission', 'Presentación'],
  'stage.gov': ['政府审批', 'Government review', 'Revisión de la autoridad'],
  'stage.closing': ['交割结项', 'Closing', 'Cierre'],
  'stage.hold': ['暂停', 'On hold', 'En pausa'],

  'role.carol': ['中国律师 · 团队负责人', 'China-qualified lawyer · Team lead', 'Abogada en China · Líder del equipo'],
  'role.carlos': ['墨西哥律师', 'Mexican lawyer', 'Abogado en México'],
  'role.hector': ['墨西哥 + 纽约双执业', 'México + New York qualified', 'Abogado en México y Nueva York'],

  'back.toList': ['← 返回事项列表', '← Back to matters', '← Volver a asuntos'],
  'back.toSettings': ['← 返回回收站', '← Back to recycle bin', '← Volver a la papelera'],
  'back.toDashboard': ['← 回到工作台', '← Back to dashboard', '← Volver al panel'],

  'detail.info': ['事项信息', 'Matter details', 'Datos del asunto'],
  'detail.client': ['客户', 'Client', 'Cliente'],
  'detail.title': ['事项名称', 'Matter name', 'Nombre del asunto'],
  'detail.area': ['业务类型', 'Practice area', 'Área'],
  'detail.areaHint': ['换业务类型会自动把项目成员改成该类事项的默认成员。', 'Changing the practice area resets the members to that area\'s default.', 'Al cambiar el área se restablecen los miembros predeterminados de esa área.'],
  'detail.stage': ['当前阶段', 'Current stage', 'Etapa actual'],
  'detail.owner': ['负责人（唯一）', 'Owner (one only)', 'Responsable (único)'],
  'detail.nextOwner': ['谁做这一步？', 'Who will do this step?', '¿Quién hará este paso?'],
  'detail.status': ['状态', 'Status', 'Estado'],
  'detail.due': ['截止日期', 'Due date', 'Fecha límite'],
  'detail.waiting': ['等待谁', 'Waiting for', 'Esperando a'],
  'detail.lastContact': ['最后联系客户', 'Last client contact', 'Último contacto con el cliente'],
  'detail.next': ['现在要做什么？', 'What needs to be done now?', '¿Qué hay que hacer ahora?'],
  'detail.reason': ['状态说明（黄／红必填）', 'Status note (required for yellow / red)', 'Nota de estado (obligatoria si es amarillo o rojo)'],
  'detail.reasonPh': ['例如：等墨方土地意见，客户在催', 'e.g. Waiting on the land opinion; client is chasing', 'p. ej. Esperando la opinión del terreno; el cliente insiste'],
  'form.reasonPh': ['为什么急', 'Why is it urgent?', '¿Por qué es urgente?'],
  'detail.notes': ['备注', 'Notes', 'Notas'],
  'detail.members': ['项目成员', 'Matter members', 'Miembros del asunto'],
  'detail.membersHint': ['只有勾进来的人能打开这条事项，没勾的人连列表里都看不到。Carol 是管理员，始终能看到全部。负责人是唯一对结果负责的人。',
    'Only the people ticked here can open this matter — others will not even see it in the list. Carol, as admin, can always see everything. The owner is the one person accountable for the outcome.',
    'Solo las personas marcadas aquí pueden abrir este asunto; las demás ni siquiera lo verán en la lista. Carol, como administradora, siempre ve todo. El responsable es quien rinde cuentas del resultado.'],
  'detail.save': ['保存修改', 'Save changes', 'Guardar cambios'],
  'detail.undoEdit': ['撤回上次修改', 'Undo last edit', 'Deshacer última modificación'],
  'detail.delete': ['删除这条事项', 'Delete this matter', 'Eliminar este asunto'],
  'detail.deleteHintOwner': ['删除后进入回收站，在设置页可以恢复。', 'It goes to the recycle bin and can be restored in Settings.', 'Va a la papelera y puede restaurarse en Ajustes.'],
  'detail.deleteHintOther': ['只有项目负责人 {name} 才能删除这条事项。', 'Only the matter owner, {name}, can delete it.', 'Solo el responsable del asunto, {name}, puede eliminarlo.'],
  'detail.deleteHintAdmin': ['你是管理员，可以删除任何事项；删除后进回收站，可在设置页恢复。',
    'As admin you can delete any matter; it goes to the recycle bin and can be restored in Settings.',
    'Como administradora puedes eliminar cualquier asunto; va a la papelera y puede restaurarse en Ajustes.'],
  'detail.notFound': ['找不到这个事项。', 'Matter not found.', 'No se encontró el asunto.'],
  'detail.noAccessTitle': ['无权查看', 'No access', 'Sin acceso'],
  'detail.noAccess1': ['「{no} {title}」的项目成员里没有你，所以打不开。', 'You are not a member of “{no} {title}”, so you cannot open it.', 'No eres miembro de «{no} {title}», así que no puedes abrirlo.'],
  'detail.noAccess2': ['需要参与的话，请项目负责人 {owner} 或 Carol 把你的名字勾进「项目成员」。',
    'To take part, ask the matter owner {owner} or Carol to add you under Matter members.',
    'Para participar, pide al responsable {owner} o a Carol que te añada en Miembros del asunto.'],
  'detail.trashTitle': ['这条事项在回收站里', 'This matter is in the recycle bin', 'Este asunto está en la papelera'],
  'detail.trashWhen': ['删除时间：{when}', 'Deleted: {when}', 'Eliminado: {when}'],
  'detail.trashRestore': ['恢复这条事项', 'Restore this matter', 'Restaurar este asunto'],
  'detail.trashAdminOnly': ['仅事项负责人 {name} 可操作', 'Only the matter owner, {name}, can act', 'Solo el responsable, {name}, puede realizar esta acción'],
  'detail.step.title': ['当前步骤', 'Current step', 'Paso actual'],
  'detail.step.button': ['完成当前步骤 →', 'Complete this step →', 'Completar este paso →'],
  'detail.step.hintOwner': ['完成时会让你填写下一步：阶段、状态、截止日期、在等谁、下一步做什么、下一步负责人。',
    'When you complete it you will fill in the next step: stage, status, due date, waiting on, what is next and who owns it.',
    'Al completarlo rellenarás el siguiente paso: etapa, estado, fecha límite, a quién esperas, qué sigue y quién lo hace.'],
  'detail.step.hintOther': ['只有当前步骤负责人 {name} 才能完成这一步。', 'Only the owner of the current step, {name}, can complete it.', 'Solo el responsable del paso actual, {name}, puede completarlo.'],
  'detail.step.hintAdmin': ['你是管理员，可以代为完成这一步（正常由 {name} 负责）。',
    'As admin you can complete this step on their behalf (normally {name}).',
    'Como administradora puedes completar este paso (normalmente lo hace {name}).'],
  'detail.undo.button': ['撤销到上一步【{text}】', 'Undo to previous step [{text}]', 'Deshacer al paso anterior [{text}]'],
  'detail.undo.hint': ['撤销会把事项退回上一步，并删掉那条完成记录。',
    'Undo sends the matter back one step and removes that completion record.',
    'Deshacer devuelve el asunto un paso atrás y borra ese registro.'],
  'detail.undo.hintDenied': ['只有管理员，或刚完成这一步的人，可以撤销。',
    'Only an admin, or the person who just completed the step, can undo.',
    'Solo la administradora o quien acaba de completar el paso puede deshacer.'],
  'detail.step.waiting': ['⏳ 在等：{w}', '⏳ Waiting on: {w}', '⏳ Esperando a: {w}'],
  'detail.history.title': ['已完成的步骤', 'Completed steps', 'Pasos completados'],
  'detail.history.count': ['{n} 步', '{n} steps', '{n} pasos'],
  'detail.history.empty': ['还没有完成过步骤。点上面的「完成当前步骤」推进第一条。', 'No steps completed yet. Use “Complete this step” above to move it forward.', 'Aún no hay pasos completados. Usa «Completar este paso» para avanzar.'],
  'detail.history.meta': ['{who} · 完成于 {when}（原定 {due}）', '{who} · completed {when} (was due {due})', '{who} · completado {when} (vencía {due})'],
  'detail.history.by': [' · 由 {name} 操作', ' · by {name}', ' · por {name}'],
  'detail.files.title': ['文件链接', 'File links', 'Enlaces de archivos'],
  'detail.files.add': ['＋ 添加', '＋ Add', '＋ Añadir'],
  'detail.files.empty': ['还没有文件链接。文件本身放在 Google Drive／飞书云盘，这里只放链接。',
    'No file links yet. The files themselves live in Google Drive or Lark Drive; only the links go here.',
    'Aún no hay enlaces. Los archivos están en Google Drive o Lark; aquí solo van los enlaces.'],
  'detail.timeline.title': ['动态记录', 'Activity', 'Actividad'],
  'detail.timeline.empty': ['还没有记录。', 'No activity yet.', 'Todavía no hay actividad.'],
  'detail.entry.new': ['新建事项 {no}（{area}）', 'Created matter {no} ({area})', 'Asunto creado {no} ({area})'],
  'detail.entry.status': ['状态更新为 {status}', 'Status set to {status}', 'Estado cambiado a {status}'],
  'detail.entry.next': ['下一步更新为：{next}', 'Next step set to: {next}', 'Próximo paso: {next}'],
  'detail.entry.due': ['截止日期更新为 {date}（{rel}）', 'Due date set to {date} ({rel})', 'Fecha límite: {date} ({rel})'],
  'detail.entry.owner': ['负责人变更为 {name}', 'Owner changed to {name}', 'Responsable cambiado a {name}'],
  'detail.entry.waiting': ['等待谁更新为：{w}', 'Waiting for set to: {w}', 'Esperando a: {w}'],
  'detail.entry.edited': ['更新了事项信息', 'Matter details updated', 'Datos del asunto actualizados'],
  'detail.entry.editUndo': ['撤回了上次修改', 'Undid the last edit', 'Deshizo la última modificación'],
  'detail.entry.note': ['{text}', '{text}', '{text}'],
  'detail.entry.fileAdd': ['添加文件链接：{name}', 'File link added: {name}', 'Enlace añadido: {name}'],
  'detail.entry.fileRemove': ['移除文件链接：{name}', 'File link removed: {name}', 'Enlace eliminado: {name}'],
  'detail.entry.deleted': ['删除事项（已进入回收站）', 'Matter deleted (moved to recycle bin)', 'Asunto eliminado (a la papelera)'],
  'detail.entry.restored': ['从回收站恢复', 'Restored from recycle bin', 'Restaurado desde la papelera'],
  'detail.entry.stepUndo': ['撤销到上一步：{text}', 'Undone back to: {text}', 'Deshecho hasta: {text}'],
  'detail.entry.stepDone': ['完成步骤：{text}（负责人 {owner}）', 'Step completed: {text} (owner {owner})', 'Paso completado: {text} (responsable {owner})'],
  'detail.entry.stageMove': ['阶段推进：{from} → {to}', 'Stage moved: {from} → {to}', 'Etapa: {from} → {to}'],
  'detail.entry.advanced': ['状态 {status}｜下一步：{next}（{owner}，{due}）', 'Status {status} | next: {next} ({owner}, {due})', 'Estado {status} | siguiente: {next} ({owner}, {due})'],
  'detail.entry.chat': ['发送消息：{message}', 'Message sent: {message}', 'Mensaje enviado: {message}'],
  'detail.entry.readReceipt': ['{reader} 已读通知', '{reader} read the notification', '{reader} leyó la notificación'],

  'weekly.title': ['每周视图', 'Weekly view', 'Vista semanal'],
  'weekly.desc': ['每周 30 分钟过一遍。每件事只回答四个问题：现在到哪、下一步是什么、谁做、什么时候完成。',
    'A 30-minute pass every week. Each matter answers four questions: where are we, what is next, who owns it, when is it due.',
    'Una revisión de 30 minutos por semana. Cada asunto responde cuatro preguntas: dónde estamos, qué sigue, quién lo hace y cuándo vence.'],
  'weekly.print': ['打印／导出 PDF', 'Print / export PDF', 'Imprimir / exportar PDF'],
  'weekly.items': ['· {n} 项', '· {n} matters', '· {n} asuntos'],
  'weekly.stage': ['现状', 'Where we are', 'Situación'],
  'weekly.next': ['现在该做', 'Do now', 'Hacer ahora'],
  'weekly.who': ['谁做', 'Who', 'Quién'],
  'weekly.due': ['截止', 'Due', 'Vence'],
  'weekly.waiting': ['在等谁', 'Waiting on', 'Esperando a'],
  'weekly.empty': ['没有可显示的事项。', 'Nothing to show.', 'Nada que mostrar.'],

  'settings.title': ['信息', 'Info', 'Información'],
  'settings.desc': ['成员、可见范围和编号规则。',
    'Members, visibility, and numbering.',
    'Miembros, visibilidad y numeración.'],
  'settings.reset': ['重置演示数据', 'Reset demo data', 'Restablecer datos de demo'],
  'settings.notice': ['邮件提醒只是预览，不会真的发。接上服务器后，这件事就能变成真的',
    'Email reminders are only a preview and are not actually sent. Once connected to a server, this can become real.',
    'Los recordatorios por correo son solo una vista previa y no se envían realmente. Al conectar el servidor, esto podrá hacerse realidad.'],
  'settings.members': ['团队成员', 'Team members', 'Miembros del equipo'],
  'th.name': ['姓名', 'Name', 'Nombre'],
  'th.email': ['邮箱', 'Email', 'Correo'],
  'th.role': ['角色', 'Role', 'Rol'],
  'th.access': ['权限', 'Access', 'Acceso'],
  'settings.admin': ['管理员', 'Admin', 'Administradora'],
  'settings.member': ['成员', 'Member', 'Miembro'],
  'settings.loginHint': ['登录用邮箱 + 密码（或邮件一次性链接），不用短信验证码——这正是两位墨西哥同事加不进飞书的原因。',
    'Sign-in is email + password (or a one-time email link), with no SMS code — which is exactly why the two Mexican colleagues could not join Lark.',
    'El acceso es con correo y contraseña (o un enlace de un solo uso), sin código SMS: justo lo que impedía entrar a los dos colegas mexicanos en Lark.'],
  'settings.defaultTeam': ['新事项默认勾选谁', 'Default members for new matters', 'Miembros predeterminados'],
  'settings.defaultTeamHint': ['真正的门禁是事项里的「项目成员」：只有被勾选的人能打开它，别人连列表里都看不到。这张表只是新建时的默认值，每一条事项都可以单独调整。<br>Carol 是管理员，始终能看到全部事项。',
    'The real gate is “Matter members”: only ticked people can open a matter, and others do not even see it in the list. This table is just the default for new matters, and every matter can be adjusted on its own.<br>Carol, as admin, always sees every matter.',
    'El control real son los «Miembros del asunto»: solo quienes estén marcados pueden abrirlo y los demás ni lo ven en la lista. Esta tabla es solo el valor predeterminado y cada asunto puede ajustarse.<br>Carol, como administradora, siempre ve todo.'],
  'settings.trash': ['回收站', 'Recycle bin', 'Papelera'],
  'settings.trashCount': ['{n} 条', '{n} matters', '{n} asuntos'],
  'settings.trashEmpty': ['回收站是空的。删除的事项会先放到这里，可以恢复。', 'The recycle bin is empty. Deleted matters land here first and can be restored.', 'La papelera está vacía. Los asuntos eliminados llegan aquí y pueden restaurarse.'],
  'settings.trashMeta': ['{client} · 删除于 {when}', '{client} · deleted {when}', '{client} · eliminado {when}'],
  'settings.trashRestore': ['恢复', 'Restore', 'Restaurar'],
  'settings.trashPurge': ['彻底删除', 'Delete forever', 'Eliminar definitivamente'],
  'trash.selectAll': ['全选可操作事项', 'Select all available', 'Seleccionar todos los disponibles'],
  'trash.bulkPurge': ['批量彻底删除', 'Delete forever in bulk', 'Eliminar definitivamente en lote'],
  'settings.trashAdminOnly': ['仅事项负责人{name}可操作', 'Only matter owner {name} can act', 'Solo el responsable {name} puede realizar esta acción'],
  'settings.trashHint': ['恢复或彻底删除事项，只能由该事项的<b>负责人</b>操作。',
    'Only the matter <b>owner</b> can restore or permanently delete it.',
    'Solo el <b>responsable</b> del asunto puede restaurarlo o eliminarlo definitivamente.'],
  'trash.desc': ['删除的事项会保留在这里；只有事项负责人可以恢复或彻底删除。',
    'Deleted matters stay here; only the matter owner can restore or permanently delete them.',
    'Los asuntos eliminados quedan aquí; solo su responsable puede restaurarlos o eliminarlos definitivamente.'],
  'settings.numbering': ['编号规则', 'Numbering', 'Numeración'],
  'settings.numberFormat': ['格式', 'Format', 'Formato'],
  'settings.numberFormatValue': ['年份 - 三位序号', 'Year + 3 digits', 'Año + 3 dígitos'],
  'settings.numberExample': ['示例', 'Example', 'Ejemplo'],
  'settings.numberNext': ['下一条编号', 'Next number', 'Próximo número'],
  'modal.new.title': ['新建事项', 'New matter', 'Nuevo asunto'],
  'modal.new.submit': ['创建事项', 'Create matter', 'Crear asunto'],
  'modal.new.membersHint': ['只有勾进来的人能打开这条事项。制裁／涉美事项通常只勾 Carol 与 Carlos，换业务类型会自动改默认值。',
    'Only ticked people can open this matter. Sanctions / US matters usually tick only Carol and Carlos; changing the area resets the defaults.',
    'Solo quienes estén marcados pueden abrirlo. Los asuntos de sanciones o de EE. UU. suelen marcar solo a Carol y Carlos; al cambiar el área se restablecen.'],
  'modal.file.title': ['添加文件链接', 'Add a file link', 'Añadir enlace de archivo'],
  'modal.file.name': ['文件名', 'File name', 'Nombre del archivo'],
  'modal.file.namePh': ['例如：土地权属摘要_v01.pdf', 'e.g. Land-title-memo_v01.pdf', 'p. ej. Memo-titulos_v01.pdf'],
  'modal.file.url': ['链接', 'Link', 'Enlace'],
  'modal.file.hint': ['文件本身放在 Google Drive 或飞书云盘，这里只保存链接。', 'The file itself stays in Google Drive or Lark Drive; only the link is saved here.', 'El archivo está en Google Drive o Lark; aquí solo se guarda el enlace.'],
  'modal.file.submit': ['添加', 'Add', 'Añadir'],
  'modal.chat.title': ['事项聊天', 'Matter chat', 'Chat del asunto'],
  'modal.chat.to': ['发送给事项成员', 'Send to matter members', 'Enviar a los miembros del asunto'],
  'modal.chat.noRecipients': ['这条事项没有其他可接收消息的成员。', 'This matter has no other members who can receive a message.', 'Este asunto no tiene otros miembros que puedan recibir el mensaje.'],
  'modal.chat.message': ['消息', 'Message', 'Mensaje'],
  'modal.chat.placeholder': ['输入要发给事项成员的消息…', 'Type a message for the matter members…', 'Escribe un mensaje para los miembros del asunto…'],
  'modal.chat.send': ['发送消息', 'Send message', 'Enviar mensaje'],
  'modal.complete.title': ['完成当前步骤', 'Complete the current step', 'Completar el paso actual'],
  'modal.complete.stage': ['下一步阶段', 'Next stage', 'Etapa siguiente'],
  'modal.complete.nextOwner': ['下一步负责人', 'Owner of the next step', 'Responsable del próximo paso'],
  'modal.complete.aboutTo': ['即将完成这一步', 'About to complete', 'A punto de completar'],
  'modal.complete.afterHint': ['填完了，这条事项就进入下一步。下面填的是<b>完成之后</b>的新状态。',
    'Once you save, the matter moves to the next step. Fill in the new state <b>after</b> completion.',
    'Al guardar, el asunto pasa al siguiente paso. Rellena el estado <b>posterior</b>.'],
  'modal.complete.submit': ['完成这一步', 'Complete step', 'Completar paso'],
  'form.next': ['下一步做什么', 'What is the next step', '¿Cuál es el próximo paso?'],
  'form.waiting': ['正在等待谁', 'Waiting on whom', '¿A quién esperamos?'],
  'form.nextPh': ['例如：把修改稿发给客户确认', 'e.g. Send the revised draft to the client', 'p. ej. Enviar el borrador revisado al cliente'],
  'form.stepMembers': ['当前步骤成员', 'Members for this step', 'Miembros de este paso'],
  'form.stepMembersHint': ['和详情页里的「项目成员」是同一份名单：勾谁，谁就能看到这条事项。',
    'This is the same list as “Matter members” on the detail page: whoever is ticked can see the matter.',
    'Es la misma lista que «Miembros del asunto»: quien esté marcado puede ver el asunto.'],
  'form.custom': ['自定义…', 'Custom…', 'Personalizado…'],
  'form.customAreaPh': ['输入业务类型', 'Type a practice area', 'Escribe un área de práctica'],
  'form.customStagePh': ['输入阶段名称', 'Type a stage name', 'Escribe una etapa'],
  'form.customWaitPh': ['输入在等谁', 'Type who you are waiting on', 'Escribe a quién esperas'],
  'toast.needCustom': ['选了「自定义」，请把内容填上', 'You picked “Custom” — please fill it in', 'Elegiste «Personalizado»: escribe el valor'],
  'modal.logout.title': ['退出登录？', 'Sign out?', '¿Cerrar sesión?'],
  'modal.logout.body': ['退出后需要重新输入邮箱和密码才能进来。已经记录的事项数据不会丢失。',
    'You will need your email and password to get back in. Saved matter data is not lost.',
    'Necesitarás tu correo y contraseña para volver. Los datos guardados no se pierden.'],
  'modal.logout.confirm': ['退出登录', 'Sign out', 'Cerrar sesión'],
  'modal.reset.title': ['重置为演示数据？', 'Reset to demo data?', '¿Restablecer los datos de demo?'],
  'modal.reset.body': ['你自己新增和修改的内容会被清掉，回到最初的演示数据。这一步不能撤销。',
    'Everything you added or changed will be cleared and the original demo data restored. This cannot be undone.',
    'Se borrará todo lo que añadiste o cambiaste y volverán los datos de demo. No se puede deshacer.'],
  'modal.reset.confirm': ['重置', 'Reset', 'Restablecer'],
  'modal.delete.title': ['删除这条事项？', 'Delete this matter?', '¿Eliminar este asunto?'],
  'modal.delete.body': ['确定删除「{no} {title}」吗？\n\n删除后它会进入回收站，你和团队立刻都看不到它了；需要的话可以在设置页恢复。',
    'Delete “{no} {title}”?\n\nIt goes to the recycle bin and disappears for you and the team right away; you can restore it in Settings if needed.',
    '¿Eliminar «{no} {title}»?\n\nIrá a la papelera y desaparecerá de inmediato para ti y el equipo; puedes restaurarlo en Ajustes.'],
  'modal.delete.confirm': ['删除', 'Delete', 'Eliminar'],
  'modal.bulkDelete.title': ['批量删除事项？', 'Delete matters in bulk?', '¿Eliminar asuntos en lote?'],
  'modal.bulkDelete.body': ['确定删除选中的 {n} 条事项吗？\n\n删除后将进入回收站，需要时可以恢复。',
    'Delete the {n} selected matters?\n\nThey will be moved to the recycle bin and can be restored later.',
    '¿Eliminar los {n} asuntos seleccionados?\n\nSe moverán a la papelera y podrán restaurarse más adelante.'],
  'modal.bulkDelete.confirm': ['删除 {n} 条', 'Delete {n}', 'Eliminar {n}'],
  'modal.purge.title': ['彻底删除？', 'Delete forever?', '¿Eliminar definitivamente?'],
  'modal.purge.body': ['「{no} {title}」和它的全部动态记录会被永久删除，无法恢复。',
    '“{no} {title}” and all of its activity history will be permanently deleted. This cannot be undone.',
    '«{no} {title}» y todo su historial se eliminarán para siempre. No se puede deshacer.'],
  'modal.purge.confirm': ['彻底删除', 'Delete forever', 'Eliminar definitivamente'],
  'modal.bulkPurge.title': ['批量彻底删除？', 'Delete forever in bulk?', '¿Eliminar definitivamente en lote?'],
  'modal.bulkPurge.body': ['选中的 {n} 条事项及其全部动态记录会被永久删除，无法恢复。',
    'The {n} selected matters and all their activity history will be permanently deleted. This cannot be undone.',
    'Los {n} asuntos seleccionados y todo su historial se eliminarán para siempre. No se puede deshacer.'],
  'modal.bulkPurge.confirm': ['彻底删除 {n} 条', 'Delete {n} forever', 'Eliminar {n} definitivamente'],
  'modal.denyDelete.title': ['无法删除', 'Cannot delete', 'No se puede eliminar'],
  'modal.denyDelete.body': ['只有项目负责人 <b>{name}</b> 才能删除事项。', 'Only the matter owner, <b>{name}</b>, can delete it.', 'Solo el responsable del asunto, <b>{name}</b>, puede eliminarlo.'],
  'modal.denyStep.title': ['无法完成这一步', 'Cannot complete this step', 'No se puede completar este paso'],
  'modal.denyStep.body': ['只有当前步骤负责人 <b>{name}</b> 才能完成这一步。<br><br>当前步骤：{next}',
    'Only the owner of the current step, <b>{name}</b>, can complete it.<br><br>Current step: {next}',
    'Solo el responsable del paso actual, <b>{name}</b>, puede completarlo.<br><br>Paso actual: {next}'],
  'modal.undo.title': ['撤销到上一步？', 'Undo to the previous step?', '¿Deshacer al paso anterior?'],
  'modal.undo.body': ['「{text}」会重新变成当前待办步骤（负责人 {owner}，截止 {due}），刚才那条完成记录会被删掉。\n\n这一步通常是用来修正误操作。',
    '“{text}” becomes the current pending step again (owner {owner}, due {due}), and the completion record is removed.\n\nUse this to fix a mistake.',
    '«{text}» vuelve a ser el paso pendiente (responsable {owner}, vence {due}) y se borra el registro de finalización.\n\nSirve para corregir un error.'],
  'modal.undo.confirm': ['撤销', 'Undo', 'Deshacer'],
  'modal.undoEdit.title': ['撤回上次修改？', 'Undo the last edit?', '¿Deshacer la última modificación?'],
  'modal.undoEdit.body': ['将撤回 {name} 在 {when} 保存的那次事项修改。聊天、文件、步骤和删除记录不会受影响。',
    'This will undo the matter edit saved by {name} at {when}. Chat, files, steps and deletion history are not affected.',
    'Se deshará la modificación del asunto guardada por {name} a las {when}. El chat, los archivos, los pasos y el historial de eliminación no se verán afectados.'],
  'modal.undoEdit.confirm': ['撤回修改', 'Undo edit', 'Deshacer modificación'],
  'modal.denyUndoEdit.title': ['无法撤回修改', 'Cannot undo this edit', 'No se puede deshacer esta modificación'],
  'modal.denyUndoEdit.body': ['只有管理员，或上次修改事项的人 {name}，可以撤回这次修改。',
    'Only an admin or {name}, who made the last edit, can undo it.',
    'Solo una administradora o {name}, quien hizo la última modificación, puede deshacerla.'],
  'modal.disableSystem.title': ['关闭系统通知？', 'Turn off system notifications?', '¿Desactivar las notificaciones del sistema?'],
  'modal.disableSystem.body': ['注意，关闭系统通知后任何人执行操作时都不会向您发送响铃通知，团队协作时，强烈建议您开启！',
    'Please note: after turning off system notifications, you will not receive alert notifications when anyone performs an action. We strongly recommend keeping them enabled for team collaboration!',
    'Atención: al desactivar las notificaciones del sistema, no recibirá avisos sonoros cuando alguien realice una acción. Para la colaboración del equipo, recomendamos encarecidamente mantenerlas activadas.'],
  'modal.disableSystem.confirm': ['确认关闭', 'Turn off', 'Desactivar'],
  'modal.deleteNotification.title': ['删除这条消息？', 'Delete this message?', '¿Eliminar este mensaje?'],
  'modal.deleteNotification.body': ['删除后，这条消息将从您的通知中移除，但不会影响事项动态或其他成员收到的通知。',
    'This message will be removed from your notifications. Matter activity and other members’ copies will not be affected.',
    'Este mensaje se eliminará de sus notificaciones, sin afectar la actividad del asunto ni las copias de otros miembros.'],
  'modal.deleteNotification.confirm': ['删除消息', 'Delete message', 'Eliminar mensaje'],
  'modal.denyUndo.title': ['无法撤销', 'Cannot undo', 'No se puede deshacer'],
  'modal.denyUndo.body': ['只有管理员，或刚完成这一步的人，可以撤销。<br><br>最后完成这一步的是 {name}。',
    'Only an admin, or the person who completed the step, can undo.<br><br>The last completion was by {name}.',
    'Solo la administradora o quien completó el paso puede deshacer.<br><br>La última finalización fue de {name}.'],
  'modal.delete.adminNote': ['\n\n（管理员操作：这条事项的负责人是 {name}）', '\n\n(Admin action: the matter owner is {name})', '\n\n(Acción de administradora: el responsable es {name})'],
  'modal.complete.adminNote': ['管理员操作：这一步正常由 {name} 负责。', 'Admin action: this step is normally owned by {name}.', 'Acción de administradora: este paso lo lleva {name}.'],
  'toast.undoDone': ['已撤销，回到「{text}」', 'Undone — back to “{text}”', 'Deshecho: vuelta a «{text}»'],
  'toast.editUndoDone': ['已撤回上次修改', 'Last edit undone', 'Última modificación deshecha'],
  'toast.noEditToUndo': ['没有可撤回的事项修改', 'There is no matter edit to undo', 'No hay ninguna modificación que deshacer'],
  'toast.noSteps': ['这条事项还没有完成过步骤，不能撤销。', 'No completed steps to undo yet.', 'Todavía no hay pasos completados que deshacer.'],
  'modal.cancel': ['取消', 'Cancel', 'Cancelar'],
  'common.ok': ['知道了', 'Got it', 'Entendido'],
  'common.remove': ['移除', 'Remove', 'Quitar'],
  'common.saveChanges': ['保存修改', 'Save changes', 'Guardar cambios'],

  'toast.saved': ['已保存', 'Saved', 'Guardado'],
  'toast.created': ['已创建 {no}', 'Created {no}', 'Creado {no}'],
  'toast.deleted': ['已删除 {no}，可在设置里恢复', 'Deleted {no}, restorable in Settings', 'Eliminado {no}, restaurable en Ajustes'],
  'toast.bulkDeleted': ['已删除 {n} 条事项，可在回收站恢复', '{n} matters deleted; you can restore them from the recycle bin', 'Se eliminaron {n} asuntos; puede restaurarlos desde la papelera'],
  'toast.restored': ['已恢复 {no}', 'Restored {no}', 'Restaurado {no}'],
  'toast.purged': ['已彻底删除', 'Permanently deleted', 'Eliminado definitivamente'],
  'toast.bulkPurged': ['已彻底删除 {n} 条事项', '{n} matters permanently deleted', 'Se eliminaron definitivamente {n} asuntos'],
  'toast.stepDone': ['已完成这一步，事项进入下一步', 'Step completed — the matter moved on', 'Paso completado: el asunto ha avanzado'],
  'toast.fileAdded': ['已添加文件链接', 'File link added', 'Enlace añadido'],
  'toast.chatSent': ['消息已发送', 'Message sent', 'Mensaje enviado'],
  'toast.needMessage': ['请输入消息', 'Please enter a message', 'Escribe un mensaje'],
  'toast.needChatRecipient': ['请至少勾选一位事项成员', 'Select at least one matter member', 'Selecciona al menos un miembro del asunto'],
  'toast.markedRead': ['已标为已读', 'Marked as read', 'Marcado como leído'],
  'toast.systemEnabled': ['✅已开启系统通知', '✅ System notifications enabled', '✅ Notificaciones del sistema activadas'],
  'toast.systemDisabled': ['❎已关闭系统通知', '❎ System notifications turned off', '❎ Notificaciones del sistema desactivadas'],
  'toast.notificationDeleted': ['已删除消息', 'Message deleted', 'Mensaje eliminado'],
  'toast.systemDenied': ['系统通知已被浏览器阻止', 'System notifications have been blocked by the browser', 'El navegador ha bloqueado las notificaciones del sistema'],
  'toast.loggedOut': ['已退出登录', 'Signed out', 'Sesión cerrada'],
  'toast.reset': ['已重置为演示数据', 'Demo data restored', 'Datos de demo restablecidos'],
  'toast.areaDefault': ['已按业务类型默认勾选项目成员', 'Members reset to this area\'s defaults', 'Miembros restablecidos para esta área'],
  'toast.needClient': ['客户、事项名称、下一步、截止日期都必须填写', 'Client, matter name, next step and due date are required', 'Cliente, nombre, próximo paso y fecha límite son obligatorios'],
  'toast.needReason': ['选了黄色或红色，请写一句原因', 'Yellow or red needs a short reason', 'Amarillo o rojo requiere un motivo'],
  'toast.needNext': ['请填写下一步做什么', 'Please fill in the next step', 'Indica el próximo paso'],
  'toast.needDue': ['请填写截止日期', 'Please set a due date', 'Indica la fecha límite'],
  'toast.needStatus': ['请选择状态', 'Please choose a status', 'Elige un estado'],
  'toast.needFileName': ['请填写文件名', 'Please enter a file name', 'Indica el nombre del archivo'],
  'toast.onlyOwnerDelete': ['只有项目负责人 {name} 才能删除事项', 'Only the matter owner, {name}, can delete it', 'Solo el responsable, {name}, puede eliminarlo'],
  'toast.onlyStepOwner': ['只有当前步骤负责人 {name} 才能完成这一步', 'Only the current step owner, {name}, can complete it', 'Solo el responsable del paso, {name}, puede completarlo'],
  'toast.adminRestore': ['仅事项负责人 {name} 可以恢复事项', 'Only matter owner {name} can restore it', 'Solo el responsable {name} puede restaurarlo'],
  'toast.adminPurge': ['仅事项负责人 {name} 可以彻底删除事项', 'Only matter owner {name} can delete it permanently', 'Solo el responsable {name} puede eliminarlo definitivamente'],
  'toast.exported': ['已导出 CSV', 'CSV exported', 'CSV exportado'],

  'csv.filename': ['Matter总表.csv', 'Matter-board.csv', 'Tablero-de-asuntos.csv'],
  'csv.no': ['编号', 'No.', 'Nº'],
  'csv.client': ['客户', 'Client', 'Cliente'],
  'csv.title': ['事项', 'Matter', 'Asunto'],
  'csv.area': ['业务类型', 'Practice area', 'Área'],
  'csv.owner': ['负责人', 'Owner', 'Responsable'],
  'csv.status': ['状态', 'Status', 'Estado'],
  'csv.stage': ['当前阶段', 'Stage', 'Etapa'],
  'csv.next': ['下一步', 'Next step', 'Próximo paso'],
  'csv.nextOwner': ['下一步负责人', 'Next-step owner', 'Responsable del paso'],
  'csv.due': ['截止日期', 'Due date', 'Fecha límite'],
  'csv.waiting': ['等待谁', 'Waiting for', 'Esperando a'],
  'csv.lastContact': ['最后联系客户', 'Last client contact', 'Último contacto'],
  'csv.notes': ['备注', 'Notes', 'Notas'],
  'csv.reason': ['状态说明', 'Status note', 'Nota de estado'],

  'fmt.notSet': ['未设定', 'Not set', 'Sin fecha'],
  'fmt.overdue': ['逾期 {n} 天', '{n} days overdue', 'Vencido hace {n} días'],
  'fmt.today': ['今天到期', 'Due today', 'Vence hoy'],
  'fmt.tomorrow': ['明天到期', 'Due tomorrow', 'Vence mañana'],
  'fmt.inDays': ['还有 {n} 天', 'In {n} days', 'En {n} días'],
  'fmt.pick': ['请选择日期', 'Pick a date', 'Elige una fecha'],
};

let lang = 'zh';
try {
  const savedLang = load(KEY.lang, null);
  if (savedLang && LANG_INDEX[savedLang] !== undefined) lang = savedLang;
} catch (e) { /* 用默认中文 */ }

function t(key, vars) {
  const e = STR[key];
  let s = e ? (e[LANG_INDEX[lang]] !== undefined ? e[LANG_INDEX[lang]] : e[0]) : key;
  if (vars) {
    Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
  }
  return s;
}
/* 数据里的文案支持三种语言：{zh,en,es}；用户自己输入的普通字符串原样返回 */
function L(v) {
  if (v == null) return '';
  if (typeof v === 'object' && !Array.isArray(v)) return v[lang] !== undefined ? v[lang] : (v.zh || v.en || '');
  return v;
}
function waitLabel(w) {
  return STR['wait.' + w] ? t('wait.' + w) : (w || t('wait.none'));
}
function stageLabel(s) {
  return STAGE_KEY[s] ? t(STAGE_KEY[s]) : (s || '');
}
/* 下拉 + 自定义：选「自定义…」时露出一个输入框。
   attr 形如 data-field="stage" 或 name="stage"，自定义输入框会自动带上 Custom 后缀。 */
function selectWithCustom(attr, value, options, placeholder) {
  const known = options.some(o => o.v === value);
  const isCustom = !!value && !known;
  const customAttr = attr.replace(/(data-field|name)="([^"]+)"/, '$1="$2Custom"').replace(/\s+data-area-picker\b/, '');
  return `
    <select ${attr} data-custom-select>
      ${options.map(o => `<option value="${esc(o.v)}" ${o.v === value ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}
      <option value="__custom__" ${isCustom ? 'selected' : ''}>${esc(t('form.custom'))}</option>
    </select>
    <input class="custom-input" ${customAttr} value="${isCustom ? esc(value) : ''}"
      placeholder="${esc(placeholder)}" autocomplete="off"${isCustom ? '' : ' style="display:none"'}>`;
}
function resolveCustom(value, customValue) {
  if (value !== '__custom__') return value;
  const v = String(customValue || '').trim();
  return v || null;
}
function stageOptions() { return STAGES.map(s => ({ v: s, t: stageLabel(s) })); }
function waitingOptions() { return WAITING.map(w => ({ v: w, t: waitLabel(w) })); }
function practiceAreaOptions() { return PRACTICE_AREAS.map(a => ({ v: a.id, t: areaName(a.id) })); }
function statusName(k) { return t('status.' + k); }
function statusShort(k) { return t('status.' + k + '.short'); }

const PRACTICE_AREAS = [
  { id: 'mx_invest', name: { zh: '墨西哥公司／投资', en: 'Mexico Corporate / Investment', es: 'Corporativo / Inversión en México' }, restricted: false },
  { id: 'mx_reg', name: { zh: '墨西哥监管', en: 'Mexico Regulatory', es: 'Regulación en México' }, restricted: false },
  { id: 'sanctions', name: { zh: '制裁／涉美', en: 'Sanctions / U.S.', es: 'Sanciones / EE. UU.' }, restricted: true, members: ['carol', 'carlos'] },
  { id: 'aml', name: { zh: '反洗钱／跨境支付', en: 'AML / Cross-border Payments', es: 'Prevención de lavado / Pagos transfronterizos' }, restricted: false },
  { id: 'dispute', name: { zh: '争议解决', en: 'Dispute Resolution', es: 'Resolución de disputas' }, restricted: false },
  { id: 'internal', name: { zh: '内部项目', en: 'Internal Project', es: 'Proyecto interno' }, restricted: false },
  { id: 'other', name: { zh: '其他', en: 'Other', es: 'Otro' }, restricted: false },
];
const AREA = Object.fromEntries(PRACTICE_AREAS.map(a => [a.id, a]));
function areaName(id) { return AREA[id] ? L(AREA[id].name) : (id || ''); }

const USERS = [
  { id: 'carol', name: 'Carol', short: 'C', email: '13726111370@163.com', password: '[REDACTED]', roleKey: 'role.carol', admin: true },
  { id: 'carlos', name: 'Carlos Dávila', short: 'CD', email: 'cdavila@lcbabogados.com', password: '[REDACTED]', roleKey: 'role.carlos', admin: false },
  { id: 'hector', name: 'Héctor Luján Medina', short: 'HL', email: 'hlujan@lcbabogados.com', password: '[REDACTED]', roleKey: 'role.hector', admin: false },
];
const USER = Object.fromEntries(USERS.map(u => [u.id, u]));

const STAGES = ['Engagement', 'Consultation', 'Due Diligence', 'Legal Research', 'Drafting', 'Filing / Submission', 'Government Review', 'Closing', 'On Hold'];
// 阶段在数据里统一存英文原值，界面上按语言显示
const STAGE_KEY = {
  'Engagement': 'stage.engagement',
  'Consultation': 'stage.consultation',
  'Due Diligence': 'stage.dd',
  'Legal Research': 'stage.research',
  'Drafting': 'stage.drafting',
  'Filing / Submission': 'stage.filing',
  'Government Review': 'stage.gov',
  'Closing': 'stage.closing',
  'On Hold': 'stage.hold',
};
const WAITING = ['none', 'client', 'counterparty', 'authority', 'notary', 'bank', 'ofac', 'tax', 'carol', 'carlos', 'hector', 'other'];

const STATUS = {
  green: { dot: '🟢', cls: 's-green' },
  yellow: { dot: '🟡', cls: 's-yellow' },
  red: { dot: '🔴', cls: 's-red' },
};
const STATUS_ORDER = { red: 0, yellow: 1, green: 2 };

const APP_TITLE_KEY = 'app.title';
const TEAM_NAME_KEY = 'app.team';

/* ------------------------------ 存储 ------------------------------ */

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略隐私模式下的写入失败 */ }
}

// 有些浏览器不允许 file:// 页面保存数据（Safari 常见），这时给出提示
const CAN_PERSIST = (() => {
  try {
    localStorage.setItem('__lcb_probe__', '1');
    localStorage.removeItem('__lcb_probe__');
    return true;
  } catch (e) {
    return false;
  }
})();

/* ------------------------------ 时间工具 ------------------------------ */

function iso(d) { return d.toISOString().slice(0, 10); }
function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function addDays(n) { const d = today(); d.setDate(d.getDate() + n); return d; }
function parseISO(s) { const [y, m, dd] = String(s).split('-').map(Number); return new Date(y, m - 1, dd); }
function daysFromToday(s) {
  if (!s) return null;
  return Math.round((parseISO(s) - today()) / 86400000);
}
const MONTHS = {
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};
function fmtDate(s) {
  if (!s) return t('fmt.notSet');
  const d = parseISO(s);
  if (lang === 'zh') return `${d.getMonth() + 1}月${d.getDate()}日`;
  if (lang === 'es') return `${d.getDate()} ${MONTHS.es[d.getMonth()]}`;
  return `${MONTHS.en[d.getMonth()]} ${d.getDate()}`;
}
function fmtDateShort(s) {
  if (!s) return '—';
  const d = parseISO(s);
  if (lang === 'es') return `${d.getDate()}/${d.getMonth() + 1}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtStamp(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dueClass(s) {
  const n = daysFromToday(s);
  if (n === null) return '';
  if (n < 0) return 'over';
  if (n <= 3) return 'soon';
  return '';
}
function dueText(s) {
  const n = daysFromToday(s);
  if (n === null) return t('fmt.notSet');
  if (n < 0) return t('fmt.overdue', { n: -n });
  if (n === 0) return t('fmt.today');
  if (n === 1) return t('fmt.tomorrow');
  return t('fmt.inDays', { n });
}
function isThisWeek(s) {
  const n = daysFromToday(s);
  return n !== null && n >= 0 && n <= 7;
}

/* ------------------------------ 示例数据 ------------------------------ */

function seedMatters() {
  const all = ['carol', 'carlos', 'hector'];
  const cc = ['carol', 'carlos'];
  return [
    {
      id: 35, no: '2026-035', client: 'ABC Ltd',
      title: { zh: '墨西哥设厂项目', en: 'Mexico plant setup', es: 'Proyecto de planta en México' },
      area: 'mx_invest', owner: 'carol', team: all, stage: 'Due Diligence',
      status: 'yellow',
      reason: { zh: '等墨方土地权属意见，客户在催', en: 'Waiting on the land-title opinion; client is chasing', es: 'Esperando la opinión de títulos; el cliente insiste' },
      next: { zh: '墨方核实土地权属并出具摘要', en: 'Verify land title in Mexico and issue a memo', es: 'Verificar títulos de propiedad y emitir un memo' },
      nextOwner: 'carlos',
      due: iso(addDays(6)), waiting: 'notary',
      files: [{ name: { zh: '土地权属摘要_v01.pdf（Google Drive）', en: 'Land-title-memo_v01.pdf (Google Drive)', es: 'Memo-titulos_v01.pdf (Google Drive)' }, url: 'https://drive.google.com/' }],
      lastContact: iso(addDays(-2)),
      notes: { zh: '客户希望 9 月底前完成尽调。', en: 'Client wants the diligence done by end of September.', es: 'El cliente quiere el due diligence a fin de mes.' },
      steps: [
        { text: { zh: '签署委托协议与收费确认', en: 'Engagement letter signed and fees confirmed', es: 'Carta de encargo firmada y honorarios confirmados' },
          owner: 'carol', due: iso(addDays(-30)), at: Date.now() - 30 * 86400000, by: 'carol',
          note: { zh: '客户当天回签', en: 'Client signed the same day', es: 'El cliente firmó el mismo día' } },
        { text: { zh: '收集公司基础文件（章程、股东名册）', en: 'Collected corporate documents (charter, cap table)', es: 'Documentos corporativos recopilados (estatutos, accionistas)' },
          owner: 'carol', due: iso(addDays(-12)), at: Date.now() - 12 * 86400000, by: 'carol',
          prev: { stage: 'Engagement', status: 'green', reason: '', team: all } },
      ],
    },
    {
      id: 36, no: '2026-036',
      client: { zh: 'XYZ 集团', en: 'XYZ Group', es: 'Grupo XYZ' },
      title: { zh: '银行 OFAC 冻结款项', en: 'OFAC-frozen bank payment', es: 'Pago bloqueado por OFAC' },
      area: 'sanctions', owner: 'carol', team: cc, stage: 'Filing / Submission',
      status: 'red',
      reason: { zh: '银行 9/15 前必须回函，材料还差一份', en: 'The bank needs a reply by Sep 15; one document is missing', es: 'El banco exige respuesta antes del 15/9; falta un documento' },
      next: { zh: '补交 MT103 与贸易合同，完成许可申请递交', en: 'File MT103 and the trade contract, submit the licence application', es: 'Presentar MT103 y el contrato, y la solicitud de licencia' },
      nextOwner: 'carol',
      due: iso(addDays(3)), waiting: 'bank',
      files: [], lastContact: iso(addDays(-1)),
      notes: { zh: '涉美事项，Hector 不参与。', en: 'US-related matter; Hector is not involved.', es: 'Asunto vinculado a EE. UU.; Héctor no participa.' },
      steps: [
        { text: { zh: '确认银行冻结依据与适用的制裁清单', en: 'Confirmed the bank\'s blocking basis and the applicable list', es: 'Confirmada la base del bloqueo y la lista aplicable' },
          owner: 'carol', due: iso(addDays(-9)), at: Date.now() - 9 * 86400000, by: 'carol',
          prev: { stage: 'Due Diligence', status: 'green', reason: '', team: cc },
          note: { zh: '银行援引 OFAC 二级制裁', en: 'The bank cited OFAC secondary sanctions', es: 'El banco citó sanciones secundarias de OFAC' } },
      ],
    },
    {
      id: 33, no: '2026-033',
      client: { zh: '深圳 B 科技', en: 'Shenzhen B Tech', es: 'Shenzhen B Tech' },
      title: { zh: '员工派驻签证', en: 'Expat work visas', es: 'Visas de trabajo para expatriados' },
      area: 'mx_reg', owner: 'hector', team: all, stage: 'Government Review',
      status: 'red',
      reason: { zh: '客户资料逾期两周，签证预约快到了', en: 'Client documents are two weeks late and the visa appointment is close', es: 'Documentos con dos semanas de retraso y la cita de visa se acerca' },
      next: { zh: '催客户补齐无犯罪记录双认证', en: 'Chase the client for apostilled police records', es: 'Reclamar al cliente los antecedentes penales apostillados' },
      nextOwner: 'hector',
      due: iso(addDays(2)), waiting: 'client',
      files: [], lastContact: iso(addDays(-9)), notes: '',
    },
    {
      id: 31, no: '2026-031', client: 'Grupo A',
      title: { zh: 'IMMEX 续期', en: 'IMMEX renewal', es: 'Renovación IMMEX' },
      area: 'mx_reg', owner: 'carlos', team: all, stage: 'Government Review',
      status: 'yellow',
      reason: { zh: '等待经济部回执，已过三周', en: 'Waiting on the Ministry\'s reply for three weeks', es: 'Esperando respuesta de la Secretaría desde hace tres semanas' },
      next: { zh: '跟进经济部回执，必要时预约面谈', en: 'Follow up with the Ministry, book a meeting if needed', es: 'Dar seguimiento a la Secretaría y agendar reunión si hace falta' },
      nextOwner: 'carlos',
      due: iso(addDays(13)), waiting: 'authority',
      files: [], lastContact: iso(addDays(-5)), notes: '',
    },
    {
      id: 40, no: '2026-040',
      client: { zh: 'LCB 内部', en: 'LCB internal', es: 'LCB interno' },
      title: { zh: '深圳办公室启动', en: 'Shenzhen office launch', es: 'Apertura de la oficina de Shenzhen' },
      area: 'internal', owner: 'carol', team: all, stage: 'Engagement',
      status: 'yellow',
      reason: { zh: '申报口径要先确认，避免对外造成已设立印象', en: 'Settle the filing approach first so it does not look already established', es: 'Definir primero el enfoque del registro para no parecer ya constituida' },
      next: { zh: '确认深圳市司法局最新申报要求与材料清单', en: 'Confirm the latest Shenzhen filing requirements and checklist', es: 'Confirmar los requisitos y la lista de documentos de Shenzhen' },
      nextOwner: 'carol',
      due: iso(addDays(18)), waiting: 'authority',
      files: [], lastContact: iso(addDays(-3)),
      notes: { zh: '内部战略项目，不混入客户 Matter。', en: 'Internal strategic project, kept out of client matters.', es: 'Proyecto interno, fuera de los asuntos de clientes.' },
    },
    {
      id: 37, no: '2026-037', client: 'ABC Ltd',
      title: { zh: '合资公司 SHA 起草', en: 'JV shareholders\' agreement', es: 'Acuerdo de socios (JV)' },
      area: 'mx_invest', owner: 'carlos', team: all, stage: 'Drafting',
      status: 'green', reason: '',
      next: { zh: '完成 SHA 第二稿并交 Carol 复核', en: 'Finish draft 2 of the SHA for Carol to review', es: 'Terminar el segundo borrador del acuerdo para revisión de Carol' },
      nextOwner: 'carlos',
      due: iso(addDays(7)), waiting: 'none',
      files: [], lastContact: iso(addDays(-4)), notes: '',
    },
    {
      id: 29, no: '2026-029',
      client: { zh: '广州 C 贸易', en: 'Guangzhou C Trading', es: 'Guangzhou C Trading' },
      title: { zh: '跨境支付合规意见', en: 'Cross-border payment compliance', es: 'Cumplimiento en pagos transfronterizos' },
      area: 'aml', owner: 'carol', team: cc, stage: 'Drafting',
      status: 'green', reason: '',
      next: { zh: '出具合规意见并电话与客户确认执行方案', en: 'Issue the compliance opinion and confirm the plan with the client', es: 'Emitir la opinión y confirmar el plan con el cliente' },
      nextOwner: 'carol',
      due: iso(addDays(11)), waiting: 'none',
      files: [], lastContact: iso(addDays(-6)), notes: '',
    },
    {
      id: 28, no: '2026-028', client: 'Italian NPE',
      title: { zh: '意大利标的尽职调查', en: 'Italian target due diligence', es: 'Due diligence del objetivo italiano' },
      area: 'dispute', owner: 'hector', team: all, stage: 'Legal Research',
      status: 'green', reason: '',
      next: { zh: '整理尽调清单初稿，交 Carlos 补充墨方口径', en: 'Prepare the diligence checklist draft for Carlos to add Mexico points', es: 'Preparar el borrador de la lista para que Carlos añada México' },
      nextOwner: 'hector',
      due: iso(addDays(24)), waiting: 'none',
      files: [], lastContact: iso(addDays(-8)), notes: '',
    },
  ];
}

function seedLogs() {
  const now = Date.now();
  const h = 3600000;
  return [
    { id: 'l1', matterId: 36, at: now - 26 * h, by: 'carol', key: 'detail.entry.status', vars: { status: { __t: 'status.red', prefix: '🔴 ' } } },
    { id: 'l2', matterId: 36, at: now - 25 * h, by: 'carol', key: 'detail.entry.next', vars: { next: { zh: '补交 MT103 与贸易合同，完成许可申请递交', en: 'File MT103 and the trade contract, submit the licence application', es: 'Presentar MT103 y el contrato, y la solicitud de licencia' } } },
    { id: 'l3', matterId: 35, at: now - 50 * h, by: 'carol', key: 'detail.entry.note', vars: { text: { zh: '结构由 SA 改为 SAPI（Carlos 确认）', en: 'Structure changed from SA to SAPI (confirmed by Carlos)', es: 'Estructura cambiada de SA a SAPI (confirmado por Carlos)' } } },
    { id: 'l4', matterId: 35, at: now - 49 * h, by: 'carlos', key: 'detail.entry.fileAdd', vars: { name: { zh: '土地权属摘要_v01.pdf', en: 'Land-title-memo_v01.pdf', es: 'Memo-titulos_v01.pdf' } } },
    { id: 'l5', matterId: 33, at: now - 72 * h, by: 'hector', key: 'detail.entry.waiting', vars: { w: { __t: 'wait.client' } } },
    { id: 'l6', matterId: 40, at: now - 74 * h, by: 'carol', key: 'detail.entry.new', vars: { no: '2026-040', area: 'Internal Project' } },
  ];
}

/* ------------------------------ 运行时状态 ------------------------------ */

let matters = load(KEY.matters, null) || [];
let logs = load(KEY.logs, null) || [];
let seq = load(KEY.seq, 0);
let session = load(KEY.session, null);   // { userId }
const state = {
  filters: { q: '', area: '', owner: '', status: '', waiting: '' },
  bulkSelected: new Set(),
  trashSelected: new Set(),
  loginError: '',
  modal: null,
};
const savedSystemSeen = load(KEY.systemSeen, null);
const systemNotice = {
  seen: new Set(Array.isArray(savedSystemSeen) ? savedSystemSeen : []),
  requesting: false,
  enabled: load(KEY.systemEnabled, null) !== false,
};
// 第一次启用时不把历史通知一口气全弹出来，只推送之后新同步到的通知。
if (!Array.isArray(savedSystemSeen)) {
  logs.forEach(l => (l.notifyTo || []).forEach(userId => systemNotice.seen.add(userId + ':' + l.id)));
  save(KEY.systemSeen, [...systemNotice.seen]);
}

function commit() {
  save(KEY.matters, matters);
  save(KEY.logs, logs);
  save(KEY.seq, seq);
  schedulePush();
}

/* ------------------------------ 与服务器同步 ------------------------------ */

function sbFetch(path, opts) {
  const headers = Object.assign({
    apikey: SUPABASE.key,
    Authorization: 'Bearer ' + SUPABASE.key,
    'Content-Type': 'application/json',
  }, (opts && opts.headers) || {});
  return fetch(SUPABASE.url + '/rest/v1' + path, Object.assign({}, opts || {}, { headers }));
}

const UPSERT = { Prefer: 'resolution=merge-duplicates,return=minimal' };
const SYNC_RETRY_LIMIT = 3;
const SYNC_RETRY_DELAY_MS = 800;

function resetSyncRetries() {
  sync.retryCount = 0;
  if (sync.retryTimer) clearTimeout(sync.retryTimer);
  sync.retryTimer = null;
}
function queueSyncRetry(kind) {
  sync.retryCount += 1;
  if (sync.retryCount >= SYNC_RETRY_LIMIT) {
    sync.status = 'error';
    sync.retryTimer = null;
    return false;
  }
  sync.status = 'loading';
  if (sync.retryTimer) clearTimeout(sync.retryTimer);
  sync.retryTimer = setTimeout(() => {
    sync.retryTimer = null;
    if (kind === 'push') pushRemote(); else pullRemote();
  }, SYNC_RETRY_DELAY_MS);
  return true;
}

// 后台同步不能打断用户：正在填表、操作弹窗或选中文字时先不刷新。
function userIsInteracting() {
  if (state.modal) return true;
  const active = document.activeElement;
  if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName || ''))) return true;
  try {
    const selection = window.getSelection && window.getSelection();
    if (selection && !selection.isCollapsed && String(selection).trim()) return true;
  } catch (e) { /* 某些浏览器不允许读取选区 */ }
  return false;
}

// 把远端的事整份拉下来（正常情况下每 15 秒一次）
async function pullRemote(opts) {
  const background = !!(opts && opts.background);
  if (background && userIsInteracting()) return;
  if (!REMOTE_ENABLED || sync.busy) return;
  if (sync.dirty) return;              // 本地还有没推上去的改动，先别覆盖
  sync.busy = true;
  try {
    const [mRes, lRes, metaRes] = await Promise.all([
      sbFetch('/matters?select=id,data&id=not.like.solo_*'),
      sbFetch('/logs?select=id,data&id=not.like.solo_*'),
      sbFetch('/meta?select=key,value&key=eq.seq'),
    ]);
    if (mRes.status === 404) throw new Error('tables-missing');
    if (!mRes.ok) throw new Error('HTTP ' + mRes.status);
    const mRows = await mRes.json();
    const lRows = lRes.ok ? await lRes.json() : [];
    const metaRows = metaRes.ok ? await metaRes.json() : [];

    const nextMatters = mRows.map(r => r.data);
    const nextLogs = lRows.map(r => r.data);
    const seqRow = metaRows.filter(r => r.key === 'seq')[0];
    const nextSeq = seqRow && typeof seqRow.value === 'number' ? seqRow.value : seq;
    const changed = JSON.stringify(nextMatters) !== JSON.stringify(matters) ||
      JSON.stringify(nextLogs) !== JSON.stringify(logs) || nextSeq !== seq;
    // 请求发出后用户可能刚开始输入；这次结果留到下一轮再取。
    if (background && userIsInteracting()) { sync.busy = false; return; }
    matters = nextMatters;
    deliverSystemNotifications(nextLogs);
    logs = nextLogs;
    seq = nextSeq;
    sync.syncedLogs = new Set(logs.map(l => l.id));
    save(KEY.matters, matters);
    save(KEY.logs, logs);
    save(KEY.seq, seq);
    sync.status = 'ok';
    resetSyncRetries();
    sync.lastAt = Date.now();
    sync.error = '';
    if (background && !changed) { syncReady = true; sync.busy = false; return; }
  } catch (e) {
    sync.error = String((e && e.message) || e);
    sync.busy = false;
    syncReady = true;
    queueSyncRetry('pull');
    render();
    return;
  }
  syncReady = true;
  sync.busy = false;
  if (background && userIsInteracting()) return;
  render();
}

async function pushRemote() {
  if (!REMOTE_ENABLED) return;
  if (sync.busy) return;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  sync.busy = true;
  try {
    if (matters.length) {
      const rows = matters.map(m => ({ id: String(m.id), data: m, updated_at: new Date().toISOString() }));
      const r = await sbFetch('/matters', { method: 'POST', headers: UPSERT, body: JSON.stringify(rows) });
      if (r.status === 404) throw new Error('tables-missing');
      if (!r.ok) throw new Error('HTTP ' + r.status);
    }
    // 已读状态会修改旧日志，所以每次都 upsert 全部日志，确保其他设备同步。
    if (logs.length) {
      const rows = logs.map(l => ({ id: l.id, matter_id: String(l.matterId), data: l }));
      const r = await sbFetch('/logs', { method: 'POST', headers: UPSERT, body: JSON.stringify(rows) });
      if (r.ok) logs.forEach(l => sync.syncedLogs.add(l.id));
    }
    await sbFetch('/meta', { method: 'POST', headers: UPSERT, body: JSON.stringify([{ key: 'seq', value: seq }]) });
    for (const id of [...sync.purged]) {
      await sbFetch('/matters?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      await sbFetch('/logs?matter_id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      sync.purged.delete(id);
    }
    sync.status = 'ok';
    resetSyncRetries();
    sync.lastAt = Date.now();
    sync.error = '';
    sync.dirty = false;
  } catch (e) {
    // 推失败：把改动留在本机，标成"未同步"，下次同步时再试
    sync.error = String((e && e.message) || e);
    sync.dirty = true;
    sync.busy = false;
    queueSyncRetry('push');
    render();
    return;
  }
  sync.busy = false;
  render();
}

let pushTimer = null;
let syncReady = !REMOTE_ENABLED;   // 首次拉取完成后才允许往服务器写，避免用本机数据覆盖别人的
function schedulePush() {
  if (!REMOTE_ENABLED) return;
  sync.dirty = true;
  if (sync.status === 'error') resetSyncRetries();
  if (!syncReady) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushRemote(); }, 500);
}
function currentUser() { return session ? USER[session.userId] : null; }

// 门禁规则：只有被勾进「项目成员」的人能打开这条事项；Carol 是管理员，始终可见。
// 业务类型不决定可见范围，只决定新建时默认勾谁。
function defaultTeam(areaId) {
  const a = AREA[areaId];
  if (a && a.members) return a.members.slice();
  return USERS.map(u => u.id);
}
function canSee(user, m) {
  if (!user) return false;
  if (user.admin) return true;
  return (m.team || []).includes(user.id);
}
function visibleMatters(user) {
  return matters.filter(m => !m.deletedAt && canSee(user, m));
}
function trashedMatters(user) {
  const u = user || currentUser();
  return matters.filter(m => m.deletedAt && canSee(u, m)).sort((a, b) => b.deletedAt - a.deletedAt);
}
function isAdmin() {
  const u = currentUser();
  return !!(u && u.admin);
}
// 当前步骤 = 这条事项正在推进的那一步，它的负责人就是「下一步负责人」
function isStepOwner(user, m) {
  return !!user && user.id === m.nextOwner;
}
function stepsOf(m) {
  return (m.steps || []).slice().sort((a, b) => b.at - a.at);
}
function lastStep(m) {
  const list = stepsOf(m);
  return list.length ? list[0] : null;
}
const MATTER_EDIT_FIELDS = ['client', 'title', 'area', 'stage', 'owner', 'nextOwner', 'status', 'due', 'waiting', 'lastContact', 'next', 'reason', 'notes', 'team'];
function cloneData(value) { return JSON.parse(JSON.stringify(value)); }
function matterEditSnapshot(m) {
  const snapshot = {};
  MATTER_EDIT_FIELDS.forEach(k => { snapshot[k] = cloneData(m[k] === undefined ? null : m[k]); });
  return snapshot;
}
function lastMatterEditLog(m) {
  return logs.filter(l => String(l.matterId) === String(m.id) && l.key === 'detail.entry.edited' &&
    l.undo && l.undo.kind === 'matter-edit' && !l.undoneAt).sort((a, b) => b.at - a.at)[0] || null;
}
function canUndoMatterEdit(user, log) {
  return !!(user && log && (user.admin || user.id === log.by));
}
// 管理员可以代为完成步骤；撤销只给管理员和「刚完成这一步的人」
function canUndoStep(user, m) {
  if (!user) return false;
  if (user.admin) return true;
  const s = lastStep(m);
  return !!(s && s.by === user.id);
}
function addLog(matterId, by, text) {
  logs.push({ id: 'l' + Math.random().toString(36).slice(2, 9), matterId, at: Date.now(), by, text });
  save(KEY.logs, logs);
}
function noticeRecipients(m, actor, explicit) {
  const ids = explicit || [...(m && m.team || []), m && m.owner];
  return [...new Set(ids.filter(Boolean))].filter(id => id !== actor && USER[id]);
}
function noticeVars(m, actor, extra) {
  return Object.assign({
    actor: (USER[actor] || {}).name || actor,
    title: m ? m.title : '',
  }, extra || {});
}
function addLogKey(matterId, by, key, vars, notice) {
  const m = matterById(matterId);
  const entry = { id: 'l' + Math.random().toString(36).slice(2, 9), matterId, at: Date.now(), by, key, vars };
  if (notice && notice.key) {
    entry.notice = { key: notice.key, vars: notice.vars || {} };
    entry.notifyTo = noticeRecipients(m, by, notice.to);
    entry.readBy = [by];
    entry.matterTitle = m ? m.title : notice.title || '';
    entry.matterNo = m ? m.no : notice.no || '';
  }
  logs.push(entry);
  save(KEY.logs, logs);
  return entry;
}
function resolveVar(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.__noticePreview) {
      const previewVars = {};
      Object.keys(v.__noticePreview.vars || {}).forEach(k => { previewVars[k] = resolveVar(v.__noticePreview.vars[k]); });
      return truncateNoticeText(t(v.__noticePreview.key, previewVars), v.max || 15);
    }
    if (v.__t) return (v.prefix || '') + t(v.__t, v.vars);
    if (v.__date !== undefined) return fmtDate(v.__date);
    if (v.__rel !== undefined) return dueText(v.__rel);
    if (v.__stage !== undefined) return stageLabel(v.__stage);
    return L(v);
  }
  return v;
}
function logText(l) {
  if (!l.key) return l.text || '';
  const vars = {};
  Object.keys(l.vars || {}).forEach(k => { vars[k] = resolveVar(l.vars[k]); });
  return t(l.key, vars);
}
function inboxEntries(user) {
  if (!user) return [];
  return logs.filter(l => l.notice && (l.notifyTo || []).includes(user.id) && !(l.deletedBy || []).includes(user.id))
    .sort((a, b) => b.at - a.at);
}
function unreadNotifications(user) {
  return inboxEntries(user).filter(l => !(l.readBy || []).includes(user.id));
}
function inboxText(l) {
  if (!l || !l.notice) return '';
  const vars = {};
  Object.keys(l.notice.vars || {}).forEach(k => { vars[k] = resolveVar(l.notice.vars[k]); });
  return t(l.notice.key, vars);
}
function truncateNoticeText(text, max) {
  const chars = [...String(text || '')];
  return chars.length > max ? chars.slice(0, max).join('') + '…' : chars.join('');
}
function systemNotificationState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted' && !systemNotice.enabled) return 'disabled';
  return Notification.permission || 'default';
}
function saveSystemSeen() {
  const ids = [...systemNotice.seen];
  save(KEY.systemSeen, ids.slice(Math.max(0, ids.length - 2000)));
}
function baselineSystemNotifications(user) {
  if (!user) return;
  inboxEntries(user).forEach(l => systemNotice.seen.add(user.id + ':' + l.id));
  saveSystemSeen();
}
function enableSystemNotifications() {
  if (typeof Notification === 'undefined') { toast(t('inbox.systemUnsupported')); return; }
  if (Notification.permission === 'denied') { toast(t('toast.systemDenied')); return; }
  baselineSystemNotifications(currentUser());
  if (Notification.permission === 'granted') {
    systemNotice.enabled = true;
    save(KEY.systemEnabled, true);
    toast(t('toast.systemEnabled'));
    render();
    return;
  }
  systemNotice.requesting = true;
  render();
  let finished = false;
  const finish = permission => {
    if (finished) return;
    finished = true;
    systemNotice.requesting = false;
    if (permission === 'granted') {
      systemNotice.enabled = true;
      save(KEY.systemEnabled, true);
    }
    toast(t(permission === 'granted' ? 'toast.systemEnabled' : 'toast.systemDenied'));
    render();
  };
  try {
    // Chrome 返回 Promise；部分 Safari 版本只调用回调且返回 undefined，两种都兼容。
    const result = Notification.requestPermission(finish);
    if (result && typeof result.then === 'function') result.then(finish).catch(() => finish(Notification.permission));
    else {
      const watchPermission = () => {
        if (finished) return;
        if (Notification.permission !== 'default') finish(Notification.permission);
        else setTimeout(watchPermission, 500);
      };
      setTimeout(watchPermission, 500);
    }
  } catch (e) {
    finish(Notification.permission);
  }
}
function deliverSystemNotifications(nextLogs) {
  const u = currentUser();
  if (!u) return;
  let changed = false;
  nextLogs.filter(l => l.notice && (l.notifyTo || []).includes(u.id) && !(l.readBy || []).includes(u.id)).forEach(l => {
    const seenKey = u.id + ':' + l.id;
    if (systemNotice.seen.has(seenKey)) return;
    systemNotice.seen.add(seenKey);
    changed = true;
    if (systemNotice.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notice = new Notification(t('system.title'), { body: inboxText(l), tag: 'lcb-' + l.id });
      notice.onclick = () => {
        if (window.focus) window.focus();
        location.hash = '#/inbox';
        render();
        if (notice.close) notice.close();
      };
    }
  });
  if (changed) saveSystemSeen();
}
function markNotificationRead(id, userId) {
  const l = logs.find(x => x.id === id);
  if (!l || !(l.notifyTo || []).includes(userId)) return false;
  if ((l.readBy || []).includes(userId)) return false;
  l.readBy = [...new Set([...(l.readBy || []), userId])];
  if (l.by !== userId && USER[l.by] && l.notice && l.notice.key !== 'inbox.readReceipt') {
    const reader = (USER[userId] || {}).name || userId;
    addLogKey(l.matterId, userId, 'detail.entry.readReceipt', { reader }, {
      key: 'inbox.readReceipt',
      vars: { reader, preview: { __noticePreview: l.notice, max: 15 } },
      to: [l.by], title: l.matterTitle, no: l.matterNo,
    });
  }
  commit();
  return true;
}
function deleteNotificationForUser(id, userId) {
  const l = logs.find(x => x.id === id);
  if (!l || !(l.notifyTo || []).includes(userId)) return false;
  l.deletedBy = [...new Set([...(l.deletedBy || []), userId])];
  commit();
  return true;
}
function undoMatterEdit(id) {
  const m = matterById(id);
  const u = currentUser();
  if (!m || !u) return false;
  const edit = lastMatterEditLog(m);
  if (!edit) { toast(t('toast.noEditToUndo')); return false; }
  if (!canUndoMatterEdit(u, edit)) return false;
  MATTER_EDIT_FIELDS.forEach(k => { m[k] = cloneData(edit.undo.before[k]); });
  edit.undoneAt = Date.now();
  edit.undoneBy = u.id;
  addLogKey(id, u.id, 'detail.entry.editUndo', {}, {
    key: 'inbox.editUndo',
    vars: noticeVars(m, u.id, {
      next: m.next,
      owner: (USER[m.nextOwner] || {}).name || m.nextOwner,
      status: { __t: 'status.' + m.status + '.short', prefix: STATUS[m.status].dot + ' ' },
    }),
  });
  commit();
  toast(t('toast.editUndoDone'));
  return true;
}
function setLang(id) {
  if (LANG_INDEX[id] === undefined) return;
  lang = id;
  save(KEY.lang, id);
  render();
}
function matterById(id) { return matters.find(m => String(m.id) === String(id)); }
function sorted(list) {
  return [...list].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return (a.due || '9999').localeCompare(b.due || '9999');
  });
}

/* ------------------------------ 小工具 ------------------------------ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function statusChip(s) {
  const st = STATUS[s] || STATUS.green;
  return `<span class="chip ${st.cls}">${st.dot} ${esc(statusShort(s))}</span>`;
}
function areaTag(id) {
  return `<span class="tag tag-area">${esc(areaName(id))}</span>`;
}
function teamTags(ids) {
  return (ids || []).map(id => `<span class="tag">${esc((USER[id] || {}).name || id)}</span>`).join('');
}
function toast(msg) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 1700);
  setTimeout(() => el.remove(), 2100);
}
function go(hash) { location.hash = hash; }

/* ------------------------------ 视图：登录 ------------------------------ */

function viewLogin() {
  const err = state.loginError;
  return `
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-mark">LCB</div>
        <div>
          <h1>${esc(t(APP_TITLE_KEY))}</h1>
          <div class="sub">${esc(t(TEAM_NAME_KEY))}</div>
        </div>
        <div style="margin-left:auto">${langSwitcher()}</div>
      </div>
      <form data-action="login">
        <div class="field">
          <label>${esc(t('login.email'))}</label>
          <input type="email" name="email" placeholder="you@lcb.com" autocomplete="username" required>
        </div>
        <div class="field">
          <label>${esc(t('login.password'))}</label>
          <input type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">${esc(t('login.signin'))}</button>
        <div class="err">${esc(err)}</div>
      </form>
      <div class="hint" style="margin-top:6px">${esc(t('login.noSms'))}</div>
    </div>
  </div>`;
}

function langSwitcher(variant) {
  return `<div class="lang-switch${variant ? ' ' + variant : ''}">${LANGS.map(l =>
    `<button type="button" class="${l.id === lang ? 'on' : ''}" data-action="set-lang" data-lang="${l.id}" title="${esc(l.name)}">${l.label}</button>`
  ).join('')}</div>`;
}

/* 顶栏的同步状态：让人一眼看出数据是不是几台设备共用的 */
function syncBadge() {
  if (!REMOTE_ENABLED) return '';
  const st = sync.status;
  if (st === 'loading') {
    return `<span class="sync-pill loading">☁ ${esc(t('sync.loading'))}</span>`;
  }
  if (st === 'error') {
    const msg = sync.error === 'tables-missing' ? t('sync.tablesMissing') : sync.error;
    return `<button class="sync-pill error" type="button" data-action="sync-now"
      title="${esc(t('sync.tipError', { msg }))}">⚠ ${esc(t('sync.failedClick'))}</button>`;
  }
  const time = sync.lastAt ? fmtStamp(sync.lastAt).slice(11) : '—';
  return `<button class="sync-pill ok" type="button" data-action="sync-now"
    title="${esc(t('sync.tipOk', { time }))}">☁ ${esc(t('sync.ok'))}</button>`;
}

/* ------------------------------ 视图：外壳 ------------------------------ */

function navFor(route) {
  const items = [
    ['#/', 'nav.dashboard'],
    ['#/matters', 'nav.matters'],
    ['#/weekly', 'nav.weekly'],
    ['#/inbox', 'nav.inbox'],
    ['#/settings', 'nav.settings'],
    ['#/trash', 'nav.trash'],
  ];
  return items.map(([href, key]) => {
    const active = (href === '#/' && (route === '/' || route === '')) || (href !== '#/' && route.startsWith(href.slice(1)));
    let badge = '';
    if (key === 'nav.matters') badge = `<span class="nav-count">${visibleMatters(currentUser()).length}</span>`;
    if (key === 'nav.inbox') {
      const unread = unreadNotifications(currentUser()).length;
      if (unread) badge = `<span class="nav-count unread-count">${unread}</span>`;
    }
    return `<a href="${href}" class="${active ? 'active' : ''}"><span class="nav-label">${esc(t(key))}${badge}</span></a>`;
  }).join('');
}

function shell(route, content) {
  const u = currentUser();
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="logo"><div class="brand-mark">LCB</div><span>${esc(t(APP_TITLE_KEY))}</span></div>
      <nav class="nav">${navFor(route)}${langSwitcher('in-nav')}</nav>
      <div class="topbar-right">
        ${syncBadge()}
        <div class="user-chip" aria-label="${esc(u.name)}" style="pointer-events:none;cursor:default">
          <span class="avatar">${esc(u.short)}</span>
          <span>
            <span class="nm">${esc(u.name)}</span>
            <span class="rl" style="display:block">${esc(t(u.roleKey))}</span>
          </span>
        </div>
        <button class="btn btn-sm btn-ghost" type="button" data-action="logout">${esc(t('topbar.signout'))}</button>
      </div>
    </div>
  </div>
  <div class="page">
    ${CAN_PERSIST ? '' : `<div class="warn">${esc(t('banner.noStorage'))}</div>`}
    ${content}
  </div>`;
}

/* ------------------------------ 视图：工作台 ------------------------------ */

function viewDashboard() {
  const u = currentUser();
  const list = visibleMatters(u);
  const red = list.filter(m => m.status === 'red');
  const dueWeek = list.filter(m => isThisWeek(m.due));
  const waitingMe = list.filter(m => m.waiting === u.id || (USER[m.nextOwner] && m.nextOwner === u.id));
  const hot = sorted(list.filter(m => m.status === 'red' || m.status === 'yellow'));
  const hour = new Date().getHours();
  const greetKey = hour < 11 ? 'dash.morning' : hour < 18 ? 'dash.afternoon' : 'dash.evening';
  const greet = t(greetKey, { name: u.name.split(' ')[0] });

  const kpis = `
    <div class="kpis">
      <div class="kpi hot"><div class="k">${esc(t('dash.kpi.red'))}</div><div class="v">${red.length}</div><div class="foot">${esc(t('dash.kpi.redFoot'))}</div></div>
      <div class="kpi warm"><div class="k">${esc(t('dash.kpi.due'))}</div><div class="v">${dueWeek.length}</div><div class="foot">${esc(t('dash.kpi.dueFoot'))}</div></div>
      <div class="kpi cool"><div class="k">${esc(t('dash.kpi.mine'))}</div><div class="v">${waitingMe.length}</div><div class="foot">${esc(t('dash.kpi.mineFoot'))}</div></div>
      <div class="kpi good"><div class="k">${esc(t('dash.kpi.visible'))}</div><div class="v">${list.length}</div><div class="foot">${esc(t(u.admin ? 'dash.kpi.visibleAdmin' : 'dash.kpi.visibleMember'))}</div></div>
    </div>`;

  const rows = hot.length ? hot.map(m => `
    <div class="row" data-action="open-matter" data-id="${m.id}">
      <div class="no">${esc(m.no)}</div>
      <div class="cell-main">
        <div class="t">${esc(L(m.title))}</div>
        <div class="meta">${esc(L(m.client))} · ${esc((USER[m.owner] || {}).name || m.owner)}${m.reason ? ' · ' + esc(L(m.reason)) : ''}</div>
      </div>
      <div class="cell-next next">${esc(L(m.next))}</div>
      <div class="cell-status">${statusChip(m.status)}</div>
      <div class="cell-due due ${dueClass(m.due)}">${fmtDateShort(m.due)}<div class="small muted">${dueText(m.due)}</div></div>
    </div>`).join('') : `<div class="empty">${esc(t('dash.empty'))}</div>`;

  return `
    <div class="page-head">
      <div>
        <h1>${esc(greet)}</h1>
        <div class="desc">${esc(t('dash.desc'))}</div>
      </div>
      <div class="right">
        <button class="btn btn-primary" type="button" data-action="new-matter">${esc(t('dash.new'))}</button>
      </div>
    </div>
    ${kpis}
    <div class="card">
      <div style="padding:16px 18px 4px">
        <div class="section-title" style="margin-bottom:2px">${esc(t('dash.today'))}</div>
        <div class="small muted" style="margin-bottom:8px">${esc(t('dash.todayDesc'))}</div>
      </div>
      <div class="rows">${rows}</div>
    </div>
    <div class="legend">
      <span>${esc(t('legend.green'))}</span><span>${esc(t('legend.yellow'))}</span><span>${esc(t('legend.red'))}</span>
    </div>`;
}

/* ------------------------------ 视图：事项列表 ------------------------------ */

function filterMatters() {
  const u = currentUser();
  const f = state.filters;
  return visibleMatters(u).filter(m => {
    if (f.area && m.area !== f.area) return false;
    if (f.owner && m.owner !== f.owner) return false;
    if (f.status && m.status !== f.status) return false;
    if (f.waiting && m.waiting !== f.waiting) return false;
    if (f.q) {
      const hay = [m.no, L(m.client), L(m.title), L(m.next), L(m.notes)].join(' ').toLowerCase();
      if (!hay.includes(f.q.toLowerCase())) return false;
    }
    return true;
  });
}

function matterRowsHTML() {
  const list = sorted(filterMatters());
  if (!list.length) return '';
  return list.map(m => `
    <tr data-action="open-matter" data-id="${m.id}">
      <td class="bulk-cell"><input class="bulk-check" type="checkbox" data-action="toggle-bulk-matter" data-id="${m.id}" ${state.bulkSelected.has(String(m.id)) ? 'checked' : ''} ${currentUser().id === m.owner || isAdmin() ? '' : 'disabled'} aria-label="${esc(t('list.bulkDelete'))}: ${esc(m.no)}"></td>
      <td class="nw">${esc(m.no)}</td>
      <td>${esc(L(m.client))}</td>
      <td><b>${esc(L(m.title))}</b>${m.notes ? `<div class="small muted">${esc(L(m.notes))}</div>` : ''}</td>
      <td>${areaTag(m.area)}</td>
      <td class="nw">${esc((USER[m.owner] || {}).name || m.owner)}</td>
      <td class="nw">${statusChip(m.status)}</td>
      <td>${esc(L(m.next))}</td>
      <td class="nw">${fmtDateShort(m.due)}<div class="small muted">${dueText(m.due)}</div></td>
      <td class="nw">${esc(waitLabel(m.waiting))}</td>
      <td class="nw"><button class="btn btn-sm" type="button" data-action="chat-matter" data-id="${m.id}">${esc(t('th.chat'))}</button></td>
    </tr>`).join('');
}

function viewMatters() {
  const f = state.filters;
  const opts = (arr, val, all) => [`<option value="" ${val === '' ? 'selected' : ''}>${all}</option>`]
    .concat(arr.map(o => `<option value="${esc(o.v)}" ${val === o.v ? 'selected' : ''}>${esc(o.t)}</option>`)).join('');
  // 筛选只列出这个账号真的看得见的内容，避免出现永远是空的筛选项
  const seen = visibleMatters(currentUser());
  const areaOpts = [...new Set([...seen.map(m => m.area).filter(Boolean), 'other'])]
    .map(area => ({ v: area, t: areaName(area) }))
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
  const ownerOpts = USERS.filter(u => seen.some(m => m.owner === u.id)).map(u => ({ v: u.id, t: u.name }));
  const statusOpts = ['red', 'yellow', 'green'].map(k => ({ v: k, t: STATUS[k].dot + ' ' + statusShort(k) }));
  // 等待谁的筛选项按实际用到的值生成，自定义填的也会出现在这里
  const waitingOpts = [...new Set([...seen.map(m => m.waiting).filter(w => w && w !== 'none'), 'other'])]
    .map(w => ({ v: w, t: waitLabel(w) }))
    .sort((a, b) => String(a.t).localeCompare(String(b.t)));
  const n = sorted(filterMatters()).length;
  const bulkCount = [...state.bulkSelected].filter(id => {
    const m = matterById(id);
    return m && !m.deletedAt && canSee(currentUser(), m) && (currentUser().id === m.owner || isAdmin());
  }).length;
  const selectable = sorted(filterMatters()).filter(m => currentUser().id === m.owner || isAdmin());
  const allSelected = selectable.length > 0 && selectable.every(m => state.bulkSelected.has(String(m.id)));

  return `
    <div class="page-head">
      <div>
        <h1>${esc(t('list.title'))}</h1>
        <div class="desc">${esc(t('list.desc', { n }))}${esc(t(currentUser().admin ? 'list.descAdmin' : 'list.descMember'))}</div>
      </div>
      <div class="right">
        <button class="btn" type="button" data-action="import-matters">${esc(t('list.import'))}</button>
        <button class="btn btn-danger" type="button" data-action="bulk-delete-matters" ${bulkCount ? '' : 'disabled'}>${esc(t('list.bulkDelete'))}${bulkCount ? ` (${bulkCount})` : ''}</button>
        <button class="btn" type="button" data-action="export-csv">${esc(t('list.export'))}</button>
        <button class="btn btn-primary" type="button" data-action="new-matter">${esc(t('dash.new'))}</button>
      </div>
    </div>
    <div class="toolbar">
      <input type="search" data-filter="q" value="${esc(f.q)}" placeholder="${esc(t('list.search'))}">
      <select data-filter="area">${opts(areaOpts, f.area, t('list.allAreas'))}</select>
      <select data-filter="owner">${opts(ownerOpts, f.owner, t('list.allOwners'))}</select>
      <select data-filter="status">${opts(statusOpts, f.status, t('list.allStatus'))}</select>
      <select data-filter="waiting">${opts(waitingOpts, f.waiting, t('list.allWaiting'))}</select>
      <button class="btn btn-sm btn-ghost" type="button" data-action="clear-filters">${esc(t('list.clear'))}</button>
    </div>
    <div class="card table-wrap">
      <table class="grid">
        <thead><tr>
          <th class="bulk-cell"><input class="bulk-check" type="checkbox" data-action="toggle-all-bulk-matters" ${allSelected ? 'checked' : ''} ${selectable.length ? '' : 'disabled'} aria-label="${esc(t('list.bulkDelete'))}"></th>
          <th>${esc(t('th.no'))}</th><th>${esc(t('th.client'))}</th><th>${esc(t('th.title'))}</th>
          <th>${esc(t('th.area'))}</th><th>${esc(t('th.owner'))}</th><th>${esc(t('th.status'))}</th>
          <th>${esc(t('th.next'))}</th><th>${esc(t('th.due'))}</th><th>${esc(t('th.waiting'))}</th><th>${esc(t('th.chat'))}</th>
        </tr></thead>
        <tbody id="matter-rows">${matterRowsHTML() || ''}</tbody>
      </table>
      <div class="empty" id="matter-empty" style="${sorted(filterMatters()).length ? 'display:none' : ''}">${esc(t('list.empty'))}</div>
    </div>
    <div class="legend">
      <span>${esc(t('legend.green'))}</span><span>${esc(t('legend.yellow'))}</span><span>${esc(t('legend.red'))}</span>
    </div>`;
}

/* ------------------------------ 视图：收件箱 ------------------------------ */

function viewInbox() {
  const u = currentUser();
  const entries = inboxEntries(u);
  const systemState = systemNotificationState();
  let systemControl;
  if (systemNotice.requesting) {
    systemControl = `<span class="system-notice-state requesting">${esc(t('inbox.systemRequesting'))}</span>`;
  } else if (systemState === 'default' || systemState === 'disabled' || systemState === 'denied') {
    systemControl = `<button class="btn" type="button" data-action="enable-system-notifications">${esc(t('inbox.systemEnable'))}</button>`;
  } else if (systemState === 'granted') {
    systemControl = `<span class="system-notice-controls"><span class="system-notice-state granted">${esc(t('inbox.systemEnabled'))}</span>
      <button class="btn" type="button" data-action="disable-system-notifications">${esc(t('inbox.systemDisable'))}</button></span>`;
  } else {
    systemControl = `<span class="system-notice-state ${systemState}">${esc(t('inbox.systemUnsupported'))}</span>`;
  }
  const rows = entries.length ? entries.map(l => {
    const read = (l.readBy || []).includes(u.id);
    const actor = (USER[l.by] || {}).name || l.by;
    return `<div class="inbox-item ${read ? 'is-read' : 'is-unread'}">
      <div class="inbox-avatar">${esc((USER[l.by] || {}).short || String(actor).slice(0, 1))}</div>
      <div class="inbox-main">
        <div class="inbox-message">${esc(inboxText(l))}</div>
        <div class="inbox-meta">${esc(actor)} · ${esc(fmtStamp(l.at))} · ${esc(l.matterNo || '')}</div>
      </div>
      <div class="inbox-action">${read
        ? `<span class="read-state">✓ ${esc(t('inbox.read'))}</span>`
        : `<button class="btn btn-sm btn-primary" type="button" data-action="mark-read" data-id="${esc(l.id)}">${esc(t('inbox.markRead'))}</button>`}
        <button class="btn btn-sm btn-danger" type="button" data-action="delete-notification" data-id="${esc(l.id)}">${esc(t('inbox.delete'))}</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty">${esc(t('inbox.empty'))}</div>`;
  return `<div class="page-head"><div><h1>${esc(t('inbox.title'))}</h1><div class="desc">${esc(t('inbox.desc'))}</div>
      <div class="desc">${esc(t('inbox.systemHint'))}</div></div><div class="right">${systemControl}</div></div>
    <div class="card inbox-list">${rows}</div>`;
}

/* ------------------------------ 视图：事项详情 ------------------------------ */

function viewMatter(id) {
  const m = matterById(id);
  const u = currentUser();
  if (!m) return `<div class="card card-pad">${esc(t('detail.notFound'))}<a href="#/matters">${esc(t('back.toList'))}</a></div>`;
  // 先查权限：删掉的事项也不能让项目外的人看见
  if (!canSee(u, m)) {
    return `
      <div class="page-head"><div><h1>${esc(t('detail.noAccessTitle'))}</h1>
      <div class="desc">${esc(t('detail.noAccess1', { no: m.no, title: L(m.title) }))}</div>
      <div class="desc">${esc(t('detail.noAccess2', { owner: (USER[m.owner] || {}).name || m.owner }))}</div></div></div>
      <div class="card card-pad"><a href="#/">${esc(t('back.toDashboard'))}</a></div>`;
  }
  if (m.deletedAt) {
    return `
      <a class="back" href="#/trash">${esc(t('back.toSettings'))}</a>
      <div class="page-head"><div>
        <h1>${esc(t('detail.trashTitle'))}</h1>
        <div class="desc">${esc(m.no)} · ${esc(L(m.client))} · ${esc(L(m.title))}</div>
        <div class="desc">${esc(t('detail.trashWhen', { when: fmtStamp(m.deletedAt) }))}</div>
      </div></div>
      <div class="card card-pad">
        ${currentUser().id === m.owner
          ? `<button class="btn btn-primary" type="button" data-action="restore-matter" data-id="${m.id}">${esc(t('detail.trashRestore'))}</button>`
          : `<div class="muted">${esc(t('detail.trashAdminOnly', { name: (USER[m.owner] || {}).name || m.owner }))}</div>`}
      </div>`;
  }

  const myLogs = logs.filter(l => String(l.matterId) === String(m.id)).sort((a, b) => b.at - a.at);
  const steps = stepsOf(m);
  const last = lastStep(m);
  const lastEdit = lastMatterEditLog(m);
  const areaField = selectWithCustom('data-field="area" data-area-picker', m.area, practiceAreaOptions(), t('form.customAreaPh'));
  const ownerOpts = USERS.map(x => `<option value="${x.id}" ${m.owner === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const nextOwnerOpts = USERS.map(x => `<option value="${x.id}" ${m.nextOwner === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const stageField = selectWithCustom('data-field="stage"', m.stage, stageOptions(), t('form.customStagePh'));
  const waitField = selectWithCustom('data-field="waiting"', m.waiting, waitingOptions(), t('form.customWaitPh'));
  const statusOpts = Object.keys(STATUS).map(k => `<option value="${k}" ${m.status === k ? 'selected' : ''}>${STATUS[k].dot} ${esc(statusName(k))}</option>`).join('');

  const teamBoxes = USERS.map(x => `
    <label class="member-item">
      <input type="checkbox" data-field="team" value="${x.id}" ${(m.team || []).includes(x.id) ? 'checked' : ''}>
      <span class="nm">${esc(x.name)}</span>
      <span class="rl">${esc(t(x.roleKey))}</span>
    </label>`).join('');

  return `
    <a class="back" href="#/matters">${esc(t('back.toList'))}</a>
    <div class="page-head">
      <div>
        <h1>${esc(L(m.title))}</h1>
        <div class="desc">${esc(m.no)} · ${esc(L(m.client))} · ${esc((USER[m.owner] || {}).name || m.owner)}</div>
      </div>
      <div class="right">
        <button class="btn" type="button" data-action="export-csv" data-id="${m.id}">${esc(t('list.export'))}</button>
        ${lastEdit ? `<button class="btn" type="button" data-action="undo-matter-edit" data-id="${m.id}">${esc(t('detail.undoEdit'))}</button>` : ''}
        <button class="btn btn-primary" type="button" data-action="save-matter" data-id="${m.id}">${esc(t('detail.save'))}</button>
      </div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card card-pad" data-matter="${m.id}">
          <div class="section-title">${esc(t('detail.info'))}</div>
          <div class="grid-2">
            <div class="field"><label>${esc(t('detail.client'))}</label><input data-field="client" value="${esc(L(m.client))}"></div>
            <div class="field"><label>${esc(t('detail.title'))}</label><input data-field="title" value="${esc(L(m.title))}"></div>
            <div class="field"><label>${esc(t('detail.area'))}</label>${areaField}
              <div class="hint">${esc(t('detail.areaHint'))}</div></div>
            <div class="field"><label>${esc(t('detail.stage'))}</label>${stageField}</div>
            <div class="field"><label>${esc(t('detail.owner'))}</label><select data-field="owner">${ownerOpts}</select></div>
            <div class="field"><label>${esc(t('detail.nextOwner'))}</label><select data-field="nextOwner">${nextOwnerOpts}</select></div>
            <div class="field"><label>${esc(t('detail.status'))}</label><select data-field="status">${statusOpts}</select></div>
            <div class="field"><label>${esc(t('detail.due'))}</label><input type="date" data-field="due" value="${esc(m.due || '')}"></div>
            <div class="field"><label>${esc(t('detail.waiting'))}</label>${waitField}</div>
            <div class="field"><label>${esc(t('detail.lastContact'))}</label><input type="date" data-field="lastContact" value="${esc(m.lastContact || '')}"></div>
          </div>
          <div class="field"><label>${esc(t('detail.next'))}</label><input data-field="next" value="${esc(L(m.next))}"></div>
          <div class="field"><label>${esc(t('detail.reason'))}</label><input data-field="reason" value="${esc(L(m.reason))}" placeholder="${esc(t('detail.reasonPh'))}"></div>
          <div class="field"><label>${esc(t('detail.notes'))}</label><textarea data-field="notes" rows="3">${esc(L(m.notes))}</textarea></div>
          <div class="field"><label>${esc(t('detail.members'))}</label><div class="member-list">${teamBoxes}</div>
            <div class="hint">${esc(t('detail.membersHint'))}</div></div>
          <div class="danger-zone">
            <button class="btn btn-danger btn-sm" type="button" data-action="delete-matter" data-id="${m.id}">${esc(t('detail.delete'))}</button>
            <span class="small muted">${u.id === m.owner
              ? esc(t('detail.deleteHintOwner'))
              : (u.admin
                ? esc(t('detail.deleteHintAdmin'))
                : esc(t('detail.deleteHintOther', { name: (USER[m.owner] || {}).name || m.owner })))}</span>
          </div>
        </div>
      </div>
      <div>
        <div class="card card-pad" style="margin-bottom:16px">
          <div class="section-title">${esc(t('detail.step.title'))}
            <span class="tag" style="margin-left:auto">${esc((USER[m.nextOwner] || {}).name || m.nextOwner)}</span>
          </div>
          <div class="step-now">${esc(L(m.next))}</div>
          <div class="step-meta">
            <span class="${dueClass(m.due)}">📅 ${fmtDate(m.due)} · ${dueText(m.due)}</span>
            <span>${esc(t('detail.step.waiting', { w: waitLabel(m.waiting) }))}</span>
          </div>
          <button class="btn btn-primary btn-block" type="button" data-action="complete-step" data-id="${m.id}">${esc(t('detail.step.button'))}</button>
          ${last
            ? `<button class="btn btn-block btn-wrap" style="margin-top:8px" type="button" data-action="undo-step" data-id="${m.id}">${esc(t('detail.undo.button', { text: L(last.text) }))}</button>
               <div class="hint" style="margin-top:6px">${u.admin || last.by === u.id ? esc(t('detail.undo.hint')) : esc(t('detail.undo.hintDenied'))}</div>`
            : ''}
          <div class="hint" style="margin-top:8px">${u.id === m.nextOwner
            ? esc(t('detail.step.hintOwner'))
            : (u.admin
              ? esc(t('detail.step.hintAdmin', { name: (USER[m.nextOwner] || {}).name || m.nextOwner }))
              : esc(t('detail.step.hintOther', { name: (USER[m.nextOwner] || {}).name || m.nextOwner })))}</div>
        </div>
        <div class="card card-pad" style="margin-bottom:16px">
          <div class="section-title">${esc(t('detail.files.title'))}
            <button class="btn btn-sm" style="margin-left:auto" type="button" data-action="add-file" data-id="${m.id}">${esc(t('detail.files.add'))}</button>
          </div>
          <div class="files">
            ${(m.files || []).length ? m.files.map((f, i) => `
              <div class="file-item">
                <span>📎</span>
                <a class="nm" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(L(f.name))}</a>
                <button class="btn btn-sm btn-ghost" type="button" data-action="remove-file" data-id="${m.id}" data-idx="${i}">${esc(t('common.remove'))}</button>
              </div>`).join('') : `<div class="small muted">${esc(t('detail.files.empty'))}</div>`}
          </div>
        </div>
        <div class="card card-pad" style="margin-bottom:16px">
          <div class="section-title">${esc(t('detail.history.title'))}
            <span class="small muted" style="margin-left:auto;font-weight:400">${esc(t('detail.history.count', { n: steps.length }))}</span>
          </div>
          ${steps.length ? steps.map(s => `
            <div class="step-done">
              <div class="sd-text">✓ ${esc(L(s.text))}</div>
              <div class="small muted">${esc(t('detail.history.meta', { who: (USER[s.owner] || {}).name || s.owner, when: fmtStamp(s.at), due: fmtDate(s.due) }))}${
                s.by && s.by !== s.owner ? esc(t('detail.history.by', { name: (USER[s.by] || {}).name || s.by })) : ''}</div>
              ${s.note ? `<div class="small">${esc(L(s.note))}</div>` : ''}
            </div>`).join('')
            : `<div class="small muted">${esc(t('detail.history.empty'))}</div>`}
        </div>
        <div class="card card-pad">
          <div class="section-title">${esc(t('detail.timeline.title'))}</div>
          <div class="timeline">
            ${myLogs.length ? myLogs.slice(0, 40).map(l => `
              <div class="tl-item ${l.at > Date.now() - 86400000 ? 'hot' : ''}">
                <div class="when">${fmtStamp(l.at)} · ${esc((USER[l.by] || {}).name || l.by)}</div>
                <div class="what">${esc(logText(l))}</div>
              </div>`).join('') : `<div class="small muted">${esc(t('detail.timeline.empty'))}</div>`}
          </div>
        </div>
      </div>
    </div>`;
}

/* ------------------------------ 视图：每周视图 ------------------------------ */

function viewWeekly() {
  const u = currentUser();
  const list = sorted(visibleMatters(u));
  const byOwner = USERS.map(x => ({ user: x, items: list.filter(m => m.owner === x.id) }))
    .filter(g => g.items.length);

  const cols = byOwner.map(g => `
    <div class="weekly-col">
      <h3><span class="avatar" style="background:#e7eefc">${esc(g.user.short)}</span>${esc(g.user.name)}
        <span class="muted small">${esc(t('weekly.items', { n: g.items.length }))}</span></h3>
      ${g.items.map(m => `
        <div class="wcard" data-action="open-matter" data-id="${m.id}" style="cursor:pointer">
          <div class="h">${statusChip(m.status)}<span class="nm">${esc(L(m.title))}</span></div>
          <dl>
            <dt>${esc(t('weekly.stage'))}</dt><dd>${esc(stageLabel(m.stage))}（${esc(L(m.client))}）</dd>
            <dt>${esc(t('weekly.next'))}</dt><dd>${esc(L(m.next))}</dd>
            <dt>${esc(t('weekly.who'))}</dt><dd>${esc((USER[m.nextOwner] || {}).name || m.nextOwner)}</dd>
            <dt>${esc(t('weekly.due'))}</dt><dd class="${dueClass(m.due)}">${fmtDate(m.due)} · ${dueText(m.due)}</dd>
            <dt>${esc(t('weekly.waiting'))}</dt><dd>${esc(waitLabel(m.waiting))}</dd>
          </dl>
        </div>`).join('')}
    </div>`).join('');

  return `
    <div class="page-head">
      <div>
        <h1>${esc(t('weekly.title'))}</h1>
        <div class="desc">${esc(t('weekly.desc'))}</div>
      </div>
      <div class="right">
        <button class="btn" type="button" data-action="print">${esc(t('weekly.print'))}</button>
      </div>
    </div>
    <div class="weekly-grid">${cols || `<div class="empty">${esc(t('weekly.empty'))}</div>`}</div>`;
}

/* ------------------------------ 视图：设置 ------------------------------ */

function viewSettings() {
  const rows = PRACTICE_AREAS.map(a => {
    const ids = defaultTeam(a.id);
    const cells = USERS.map(u => {
      const ok = ids.includes(u.id);
      return `<td class="${ok ? 'yes' : 'no'}">${ok ? '✓' : '—'}</td>`;
    }).join('');
    return `<tr><td>${esc(areaName(a.id))}</td>${cells}</tr>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <h1>${esc(t('settings.title'))}</h1>
        <div class="desc">${esc(t('settings.desc'))}</div>
      </div>
    </div>
    <div class="notice">${esc(t('settings.notice'))}</div>
    <div class="detail-grid">
      <div>
        <div class="card card-pad" style="margin-bottom:16px">
          <div class="section-title">${esc(t('settings.members'))}</div>
          <table class="matrix">
            <thead><tr><th>${esc(t('th.name'))}</th><th>${esc(t('th.email'))}</th><th>${esc(t('th.role'))}</th><th>${esc(t('th.access'))}</th></tr></thead>
            <tbody>
              ${USERS.map(u => `<tr>
                <td><b>${esc(u.name)}</b></td>
                <td>${esc(u.email)}</td>
                <td>${esc(t(u.roleKey))}</td>
                <td>${u.admin ? `<span class="yes">${esc(t('settings.admin'))}</span>` : esc(t('settings.member'))}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div class="hint" style="margin-top:10px">${esc(t('settings.loginHint'))}</div>
        </div>
        <div class="card card-pad">
          <div class="section-title">${esc(t('settings.defaultTeam'))}</div>
          <table class="matrix">
            <thead><tr><th>${esc(t('th.area'))}</th>${USERS.map(u => `<th>${esc(u.name)}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="hint" style="margin-top:10px">${t('settings.defaultTeamHint')}</div>
        </div>
      </div>
      <div>
        <div class="card card-pad" style="margin-bottom:16px">
          <div class="section-title">${esc(t('settings.numbering'))}</div>
          <div class="kv"><span class="k">${esc(t('settings.numberFormat'))}</span><span class="v">${esc(t('settings.numberFormatValue'))}</span></div>
          <div class="kv"><span class="k">${esc(t('settings.numberExample'))}</span><span class="v">2026-041</span></div>
          <div class="kv"><span class="k">${esc(t('settings.numberNext'))}</span><span class="v">2026-${String(seq + 1).padStart(3, '0')}</span></div>
        </div>
      </div>
    </div>`;
}

function viewTrash() {
  const trashed = trashedMatters();
  const u = currentUser();
  const selectable = trashed.filter(m => u.id === m.owner);
  const selectedCount = selectable.filter(m => state.trashSelected.has(String(m.id))).length;
  const allSelected = selectable.length > 0 && selectable.every(m => state.trashSelected.has(String(m.id)));
  return `
    <div class="page-head">
      <div>
        <h1>${esc(t('settings.trash'))}</h1>
        <div class="desc">${esc(t('trash.desc'))}</div>
      </div>
      <div class="right"><button class="btn btn-danger" type="button" data-action="bulk-purge-trash" ${selectedCount ? '' : 'disabled'}>${esc(t('trash.bulkPurge'))}${selectedCount ? ` (${selectedCount})` : ''}</button></div>
    </div>
    <div class="card card-pad">
      <div class="section-title">${esc(t('settings.trash'))}
        <label class="trash-select-all"><input class="bulk-check" type="checkbox" data-action="toggle-all-trash" ${allSelected ? 'checked' : ''} ${selectable.length ? '' : 'disabled'}> ${esc(t('trash.selectAll'))}</label>
        <span class="small muted" style="margin-left:auto;font-weight:400">${esc(t('settings.trashCount', { n: trashed.length }))}</span>
      </div>
      ${trashed.length ? trashed.map(m => `
        <div class="trash-row">
          <input class="bulk-check" type="checkbox" data-action="toggle-trash-matter" data-id="${m.id}" ${state.trashSelected.has(String(m.id)) ? 'checked' : ''} ${u.id === m.owner ? '' : 'disabled'} aria-label="${esc(t('trash.bulkPurge'))}: ${esc(m.no)}">
          <span class="nm"><b>${esc(m.no)} ${esc(L(m.title))}</b>
            <span class="meta">${esc(t('settings.trashMeta', { client: L(m.client), when: fmtStamp(m.deletedAt) }))}</span></span>
          ${u.id === m.owner ? `
            <button class="btn btn-sm" type="button" data-action="restore-matter" data-id="${m.id}">${esc(t('settings.trashRestore'))}</button>
            <button class="btn btn-sm btn-danger" type="button" data-action="purge-matter" data-id="${m.id}">${esc(t('settings.trashPurge'))}</button>`
            : `<span class="small muted">${esc(t('settings.trashAdminOnly', { name: (USER[m.owner] || {}).name || m.owner }))}</span>`}
        </div>`).join('')
        : `<div class="small muted">${esc(t('settings.trashEmpty'))}</div>`}
      <div class="hint" style="margin-top:10px">${t('settings.trashHint')}</div>
    </div>`;
}

/* ------------------------------ 弹窗：新建事项 ------------------------------ */

function modalFrame(title, body, footer) {
  return `
  <div class="modal-mask" data-mask="1">
    <div class="modal">
      <div class="modal-head"><h2>${esc(title)}</h2></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${footer}</div>
    </div>
  </div>`;
}

function modalConfirm(mo) {
  return modalFrame(
    t(mo.titleKey),
    `<div style="font-size:14px;color:var(--ink-2);line-height:1.75;white-space:pre-line">${esc(mo.body || '')}</div>`,
    `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button>
     <button class="btn ${mo.danger ? 'btn-danger-solid' : 'btn-primary'}" type="button"
       data-action="${mo.action}"${mo.id ? ` data-id="${mo.id}"` : ''}>${esc(mo.confirmText || t(mo.confirmKey))}</button>`
  );
}

function modalNotice(mo) {
  return modalFrame(
    t(mo.titleKey),
    `<div style="font-size:14.5px;color:var(--ink-2);line-height:1.75">${mo.body || ''}</div>`,
    `<button class="btn btn-primary" type="button" data-action="close-modal">${esc(t('common.ok'))}</button>`
  );
}

function modalCompleteStep(mo) {
  const m = matterById(mo.matterId);
  if (!m) return '';
  const stageField = selectWithCustom('name="stage"', m.stage, stageOptions(), t('form.customStagePh'));
  const statusOpts = Object.keys(STATUS).map(k =>
    `<option value="${k}" ${m.status === k ? 'selected' : ''}>${STATUS[k].dot} ${esc(statusName(k))}</option>`).join('');
  const waitField = selectWithCustom('name="waiting"', m.waiting, waitingOptions(), t('form.customWaitPh'));
  const ownerOpts = USERS.map(x =>
    `<option value="${x.id}" ${m.nextOwner === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const members = USERS.map(x => `
    <label class="member-item">
      <input type="checkbox" name="team" value="${x.id}" ${(m.team || []).includes(x.id) ? 'checked' : ''}>
      <span class="nm">${esc(x.name)}</span>
      <span class="rl">${esc(t(x.roleKey))}</span>
    </label>`).join('');

  return modalFrame(
    t('modal.complete.title'),
    `<div class="step-box">
       <div class="small muted">${esc(t('modal.complete.aboutTo'))}</div>
       <div class="sd-text">✓ ${esc(L(m.next))}</div>
       <div class="small muted">${esc((USER[m.nextOwner] || {}).name || m.nextOwner)} · ${fmtDate(m.due)}（${dueText(m.due)}）</div>
       ${isAdmin() && currentUser().id !== m.nextOwner
         ? `<div class="small muted" style="margin-top:6px">${esc(t('modal.complete.adminNote', { name: (USER[m.nextOwner] || {}).name || m.nextOwner }))}</div>`
         : ''}
     </div>
     <div class="hint" style="margin-bottom:14px">${t('modal.complete.afterHint')}</div>
     <form id="complete-form" data-action="confirm-complete-step" data-id="${m.id}">
       <div class="grid-2">
         <div class="field"><label class="req">${esc(t('modal.complete.stage'))}</label>${stageField}</div>
         <div class="field"><label class="req">${esc(t('detail.status'))}</label><select name="status">${statusOpts}</select></div>
         <div class="field"><label class="req">${esc(t('detail.due'))}</label><input type="date" name="due" value="${esc(m.due || '')}"></div>
         <div class="field"><label>${esc(t('form.waiting'))}</label>${waitField}</div>
       </div>
       <div class="field"><label class="req">${esc(t('form.next'))}</label>
         <input name="next" autocomplete="off" placeholder="${esc(t('form.nextPh'))}"></div>
       <div class="field"><label class="req">${esc(t('modal.complete.nextOwner'))}</label><select name="nextOwner">${ownerOpts}</select></div>
       <div class="field"><label>${esc(t('detail.reason'))}</label>
         <input name="reason" autocomplete="off" value="" placeholder="${esc(t('form.reasonPh'))}"></div>
       <div class="field"><label>${esc(t('form.stepMembers'))}</label>
         <div class="member-list">${members}</div>
         <div class="hint">${esc(t('form.stepMembersHint'))}</div></div>
     </form>`,
    `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button>
     <button class="btn btn-primary" type="submit" form="complete-form">${esc(t('modal.complete.submit'))}</button>`
  );
}

function modalFile(mo) {
  const m = matterById(mo.matterId);
  if (!m) return '';
  return modalFrame(
    t('modal.file.title'),
    `<form id="file-form" data-action="confirm-add-file" data-id="${m.id}">
       <div class="field"><label class="req">${esc(t('modal.file.name'))}</label>
         <input name="fileName" placeholder="${esc(t('modal.file.namePh'))}" autocomplete="off"></div>
       <div class="field"><label>${esc(t('modal.file.url'))}</label>
         <input name="fileUrl" value="https://drive.google.com/" autocomplete="off"></div>
       <div class="hint">${esc(t('modal.file.hint'))}</div>
     </form>`,
    `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button>
     <button class="btn btn-primary" type="submit" form="file-form">${esc(t('modal.file.submit'))}</button>`
  );
}

function modalChat(mo) {
  const m = matterById(mo.matterId);
  if (!m || !canSee(currentUser(), m)) return '';
  const recipients = [...new Set([...(m.team || []), m.owner])]
    .filter(id => id !== currentUser().id && USER[id]);
  return modalFrame(
    t('modal.chat.title') + ' · ' + L(m.title),
    `<form id="chat-form" data-action="send-chat" data-id="${m.id}">
       <div class="field"><label>${esc(t('modal.chat.to'))}</label>
         <div class="member-list chat-recipients">${recipients.length ? recipients.map(id => `<label class="member-item">
           <input type="checkbox" name="chatTo" value="${esc(id)}" checked>
           <span class="nm">${esc(USER[id].name)}</span>
         </label>`).join('') : `<div class="hint">${esc(t('modal.chat.noRecipients'))}</div>`}</div></div>
       <div class="field"><label class="req">${esc(t('modal.chat.message'))}</label>
         <textarea name="message" rows="5" placeholder="${esc(t('modal.chat.placeholder'))}" autocomplete="off"></textarea></div>
     </form>`,
    `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button>
     <button class="btn btn-primary" type="submit" form="chat-form">${esc(t('modal.chat.send'))}</button>`
  );
}

function renderModal() {
  const mo = state.modal;
  if (!mo) return '';
  if (mo.type === 'new-matter') return modalNewMatter();
  if (mo.type === 'file') return modalFile(mo);
  if (mo.type === 'chat') return modalChat(mo);
  if (mo.type === 'complete-step') return modalCompleteStep(mo);
  if (mo.type === 'confirm') return modalConfirm(mo);
  if (mo.type === 'notice') return modalNotice(mo);
  if (mo.type === 'import') return modalImport();
  if (mo.type === 'import-invalid') return modalImportInvalid();
  return '';
}

function modalImport() {
  return modalFrame(t('modal.import.title'), `<div class="hint" style="margin-bottom:14px">${esc(t('modal.import.hint'))}</div><form id="import-form" data-action="import-file"><div class="field"><label class="req">${esc(t('modal.import.choose'))}</label><input type="file" name="importFile" accept=".csv,.xlsx,.xls" required></div></form>`, `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button><button class="btn btn-primary" type="submit" form="import-form">${esc(t('modal.import.confirm'))}</button>`);
}

function modalImportInvalid() {
  return modalFrame(t('modal.import.title'), `<div style="font-size:14.5px;color:var(--ink-2);line-height:1.75">${esc(t('modal.import.invalid'))}</div>`, `<button class="btn" type="button" data-action="close-modal">${esc(t('modal.import.no'))}</button><button class="btn btn-primary" type="button" data-action="download-import-sample">${esc(t('modal.import.yes'))}</button>`);
}

function modalNewMatter() {
  if (!state.modal || state.modal.type !== 'new-matter') return '';
  const areaField = selectWithCustom('name="area" data-area-picker', PRACTICE_AREAS[0].id, practiceAreaOptions(), t('form.customAreaPh'));
  const ownerOpts = USERS.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  const nextOwnerOpts = ownerOpts;
  const stageField = selectWithCustom('name="stage"', STAGES[0], stageOptions(), t('form.customStagePh'));
  const waitField = selectWithCustom('name="waiting"', 'none', waitingOptions(), t('form.customWaitPh'));
  const statusOpts = Object.keys(STATUS).map(k => `<option value="${k}" ${k === 'green' ? 'selected' : ''}>${STATUS[k].dot} ${esc(statusName(k))}</option>`).join('');
  return `
  <div class="modal-mask" data-mask="1">
    <div class="modal" data-stop="1">
      <form data-action="create-matter">
        <div class="modal-head"><h2>${esc(t('modal.new.title'))}</h2></div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="field"><label class="req">${esc(t('detail.client'))}</label><input name="client" required></div>
            <div class="field"><label class="req">${esc(t('detail.title'))}</label><input name="title" required></div>
            <div class="field"><label class="req">${esc(t('detail.area'))}</label>${areaField}</div>
            <div class="field"><label class="req">${esc(t('detail.owner'))}</label><select name="owner">${ownerOpts}</select></div>
            <div class="field"><label class="req">${esc(t('detail.stage'))}</label>${stageField}</div>
            <div class="field"><label class="req">${esc(t('detail.status'))}</label><select name="status">${statusOpts}</select></div>
            <div class="field"><label class="req">${esc(t('detail.due'))}</label><input type="date" name="due" required></div>
            <div class="field"><label>${esc(t('detail.waiting'))}</label>${waitField}</div>
          </div>
          <div class="field"><label class="req">${esc(t('detail.next'))}</label><input name="next" required></div>
          <div class="field"><label>${esc(t('detail.nextOwner'))}</label><select name="nextOwner">${nextOwnerOpts}</select></div>
          <div class="field"><label>${esc(t('detail.reason'))}</label>
            <input name="reason" autocomplete="off" value="" placeholder="${esc(t('form.reasonPh'))}"></div>
          <div class="field"><label>${esc(t('detail.members'))}</label>
            <div class="member-list">
              ${USERS.map(u => `<label class="member-item">
                <input type="checkbox" name="team" value="${u.id}" ${defaultTeam('mx_invest').includes(u.id) ? 'checked' : ''}>
                <span class="nm">${esc(u.name)}</span>
                <span class="rl">${esc(t(u.roleKey))}</span>
              </label>`).join('')}
            </div>
            <div class="hint">${esc(t('modal.new.membersHint'))}</div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" type="button" data-action="close-modal">${esc(t('modal.cancel'))}</button>
          <button class="btn btn-primary" type="submit">${esc(t('modal.new.submit'))}</button>
        </div>
      </form>
    </div>
  </div>`;
}

/* ------------------------------ 渲染 ------------------------------ */

function render() {
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const route = (location.hash || '#/').slice(1);
  const u = currentUser();

  if (!u) {
    app.innerHTML = viewLogin();
    modalRoot.innerHTML = '';
    return;
  }

  let content;
  if (route === '' || route === '/') content = viewDashboard();
  else if (route.startsWith('/matters/')) content = viewMatter(route.split('/')[2]);
  else if (route.startsWith('/matters')) content = viewMatters();
  else if (route.startsWith('/weekly')) content = viewWeekly();
  else if (route.startsWith('/inbox')) content = viewInbox();
  else if (route.startsWith('/settings')) content = viewSettings();
  else if (route.startsWith('/trash')) content = viewTrash();
  else content = viewDashboard();

  app.innerHTML = shell(route, content);
  modalRoot.innerHTML = renderModal();
  if (state.modal && state.modal.type === 'file') {
    const first = document.getElementById('file-form');
    if (first && first.fileName) first.fileName.focus();
  }
}

/* ------------------------------ 事件 ------------------------------ */

function readForm(form) {
  const data = {};
  new FormData(form).forEach((v, k) => {
    if (k === 'team') { (data.team = data.team || []).push(v); }
    else data[k] = v;
  });
  return data;
}

/* 完成当前步骤：把这一步记进历史，然后把事项推进到下一步。
   data 里是「完成之后」的新状态，字段与需求单一致。 */
function completeStep(id, data) {
  const m = matterById(id);
  const u = currentUser();
  if (!m || !u) return false;
  if (!isStepOwner(u, m) && !u.admin) { toast(t('toast.onlyStepOwner', { name: (USER[m.nextOwner] || {}).name || m.nextOwner })); return false; }
  if (!String(data.next || '').trim()) { toast(t('toast.needNext')); return false; }
  if (!data.due) { toast(t('toast.needDue')); return false; }
  if (!data.status || !STATUS[data.status]) { toast(t('toast.needStatus')); return false; }
  if ((data.status === 'red' || data.status === 'yellow') && !String(data.reason || '').trim()) {
    toast(t('toast.needReason')); return false;
  }

  const done = {
    text: m.next,
    owner: m.nextOwner,
    due: m.due,
    waiting: m.waiting,
    at: Date.now(),
    by: u.id,
    // 记下完成前的状态，撤销时才能原样退回去
    prev: { stage: m.stage, status: m.status, reason: m.reason, team: (m.team || []).slice() },
  };
  if (data.stepNote && String(data.stepNote).trim()) done.note = String(data.stepNote).trim();
  m.steps = m.steps || [];
  m.steps.push(done);

  const beforeStage = m.stage;
  const stage = resolveCustom(data.stage, data.stageCustom);
  const waiting = resolveCustom(data.waiting, data.waitingCustom);
  if (stage === null || waiting === null) { toast(t('toast.needCustom')); return false; }
  m.stage = stage || m.stage;
  m.status = data.status;
  m.due = data.due;
  m.waiting = waiting || 'none';
  m.next = String(data.next).trim();
  m.nextOwner = data.nextOwner || m.nextOwner;
  if (String(data.reason || '') !== L(m.reason)) m.reason = data.reason || '';
  if (Array.isArray(data.team) && data.team.length) {
    m.team = data.team.slice();
    if (!m.team.includes(m.owner)) m.team.push(m.owner);
  }

  addLogKey(id, u.id, 'detail.entry.stepDone', { text: done.text, owner: (USER[done.owner] || {}).name || done.owner }, {
    key: 'inbox.stepDone',
    vars: noticeVars(m, u.id, {
      step: done.text,
      next: m.next,
      owner: (USER[m.nextOwner] || {}).name || m.nextOwner,
      status: { __t: 'status.' + m.status + '.short', prefix: STATUS[m.status].dot + ' ' },
    }),
  });
  if (beforeStage !== m.stage) addLogKey(id, u.id, 'detail.entry.stageMove', { from: { __stage: beforeStage }, to: { __stage: m.stage } });
  addLogKey(id, u.id, 'detail.entry.advanced', {
    status: { __t: 'status.' + m.status, prefix: STATUS[m.status].dot + ' ' },
    next: m.next,
    owner: (USER[m.nextOwner] || {}).name || m.nextOwner,
    due: { __date: m.due },
  });
  commit();
  toast(t('toast.stepDone'));
  return true;
}

/* 撤销到上一步：删掉最近一条完成记录，把事项退回那一步 */
function undoStep(id) {
  const m = matterById(id);
  const u = currentUser();
  if (!m || !u) return false;
  const s = lastStep(m);
  if (!s) { toast(t('toast.noSteps')); return false; }
  if (!canUndoStep(u, m)) return false;

  m.next = s.text;
  m.nextOwner = s.owner;
  m.due = s.due;
  m.waiting = s.waiting || 'none';
  if (s.prev) {
    if (s.prev.stage) m.stage = s.prev.stage;
    if (s.prev.status) m.status = s.prev.status;
    m.reason = s.prev.reason === undefined ? m.reason : s.prev.reason;
    if (s.prev.team) m.team = s.prev.team.slice();
  }
  m.steps = (m.steps || []).filter(x => x !== s);
  addLogKey(id, u.id, 'detail.entry.stepUndo', { text: s.text }, {
    key: 'inbox.stepUndo',
    vars: noticeVars(m, u.id, { step: s.text, owner: (USER[s.owner] || {}).name || s.owner }),
  });
  commit();
  toast(t('toast.undoDone', { text: L(s.text) }));
  return true;
}

function createMatter(data) {
  if (!data.client || !data.title || !data.next || !data.due) { toast(t('toast.needClient')); return false; }
  if ((data.status === 'red' || data.status === 'yellow') && !String(data.reason || '').trim()) { toast(t('toast.needReason')); return false; }
  const stage = resolveCustom(data.stage, data.stageCustom);
  const waiting = resolveCustom(data.waiting, data.waitingCustom);
  const area = resolveCustom(data.area, data.areaCustom);
  if (area === null || stage === null || waiting === null) { toast(t('toast.needCustom')); return false; }
  seq += 1;
  const id = seq;
  const team = (data.team && data.team.length) ? data.team.slice() : defaultTeam(area);
  const m = {
    id, no: `2026-${String(id).padStart(3, '0')}`,
    client: data.client, title: data.title, area,
    owner: data.owner, team,
    stage: stage || STAGES[0], status: data.status, reason: data.reason || '',
    next: data.next, nextOwner: data.nextOwner || data.owner,
    due: data.due, waiting: waiting || 'none',
    files: [], lastContact: iso(today()), notes: '',
  };
  if (!m.team.includes(m.owner)) m.team.push(m.owner);
  matters.push(m);
  addLogKey(id, currentUser().id, 'detail.entry.new', { no: m.no, area: areaName(m.area) }, {
    key: 'inbox.new',
    vars: noticeVars(m, currentUser().id, {
      next: m.next,
      owner: (USER[m.nextOwner] || {}).name || m.nextOwner,
      status: { __t: 'status.' + m.status + '.short', prefix: STATUS[m.status].dot + ' ' },
    }),
  });
  commit();
  toast(t('toast.created', { no: m.no }));
  return m;
}

function saveMatterFromDom(id) {
  const box = document.querySelector(`[data-matter="${id}"]`);
  const m = matterById(id);
  if (!box || !m) return;
  const get = f => { const el = box.querySelector(`[data-field="${f}"]`); return el ? el.value : undefined; };
  const changes = [];
  const before = { ...m };
  const beforeSnapshot = matterEditSnapshot(m);
  // 表单里显示的是当前语言的文字；如果用户没改，就保留原来的多语言数据
  const shown = {
    client: L(m.client), title: L(m.title), next: L(m.next), reason: L(m.reason), notes: L(m.notes),
    area: m.area, stage: m.stage, owner: m.owner, nextOwner: m.nextOwner, status: m.status,
    due: m.due, waiting: m.waiting, lastContact: m.lastContact,
  };

  // 选了「自定义…」就必须填内容，先校验再改数据
  if ((get('area') === '__custom__' && !String(get('areaCustom') || '').trim()) ||
      (get('stage') === '__custom__' && !String(get('stageCustom') || '').trim()) ||
      (get('waiting') === '__custom__' && !String(get('waitingCustom') || '').trim())) {
    toast(t('toast.needCustom')); return;
  }
  ['client', 'title', 'area', 'stage', 'owner', 'nextOwner', 'status', 'due', 'waiting', 'lastContact', 'next', 'reason', 'notes'].forEach(f => {
    let v;
    if (f === 'area' || f === 'stage' || f === 'waiting') {
      v = resolveCustom(get(f), get(f + 'Custom'));
      if (v === null) return;
    } else {
      v = get(f);
    }
    if (v === undefined || v === shown[f]) return;
    if (v !== m[f]) { m[f] = v; changes.push(f); }
  });
  const team = [...box.querySelectorAll('[data-field="team"]:checked')].map(x => x.value);
  if (!team.includes(m.owner)) team.push(m.owner);
  if (team.slice().sort().join() !== (m.team || []).slice().sort().join()) { m.team = team; changes.push('team'); }

  if (!m.client || !m.title || !m.next || !m.due) { toast(t('toast.needClient')); return; }
  if ((m.status === 'red' || m.status === 'yellow') && !String(L(m.reason) || '').trim()) { toast(t('toast.needReason')); return; }

  if (before.status !== m.status) addLogKey(id, currentUser().id, 'detail.entry.status', { status: { __t: 'status.' + m.status, prefix: STATUS[m.status].dot + ' ' } });
  if (before.next !== m.next) addLogKey(id, currentUser().id, 'detail.entry.next', { next: L(m.next) });
  if (before.due !== m.due) addLogKey(id, currentUser().id, 'detail.entry.due', { date: { __date: m.due }, rel: { __rel: m.due } });
  if (before.owner !== m.owner) addLogKey(id, currentUser().id, 'detail.entry.owner', { name: USER[m.owner].name });
  if (before.waiting !== m.waiting) addLogKey(id, currentUser().id, 'detail.entry.waiting', { w: { __t: 'wait.' + m.waiting } });
  if (changes.length) {
    const editLog = addLogKey(id, currentUser().id, 'detail.entry.edited', {}, {
      key: 'inbox.edited',
      vars: noticeVars(m, currentUser().id, {
        next: m.next,
        owner: (USER[m.nextOwner] || {}).name || m.nextOwner,
        status: { __t: 'status.' + m.status + '.short', prefix: STATUS[m.status].dot + ' ' },
      }),
    });
    editLog.undo = { kind: 'matter-edit', before: beforeSnapshot };
  }
  commit();
  toast(t('toast.saved'));
  render();
}

function exportCSV(onlyId) {
  const u = currentUser();
  const list = onlyId ? [matterById(onlyId)].filter(Boolean) : sorted(filterMatters());
  const head = ['csv.no', 'csv.client', 'csv.title', 'csv.area', 'csv.owner', 'csv.status', 'csv.stage',
    'csv.next', 'csv.nextOwner', 'csv.due', 'csv.waiting', 'csv.lastContact', 'csv.notes'].map(k => t(k));
  const rows = list.map(m => [
    m.no, L(m.client), L(m.title), areaName(m.area), USER[m.owner].name,
    statusName(m.status), stageLabel(m.stage), L(m.next), USER[m.nextOwner] ? USER[m.nextOwner].name : m.nextOwner,
    m.due, waitLabel(m.waiting), m.lastContact, L(m.notes),
  ]);
  if (onlyId) { head.push(t('csv.reason')); rows[0].push(L(matterById(onlyId).reason)); }
  const csv = '\ufeff' + [head, ...rows]
    .map(r => r.map(x => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = onlyId ? `${matterById(onlyId).no}.csv` : t('csv.filename');
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t('toast.exported'));
}

document.addEventListener('click', ev => {
  // 点遮罩空白处关闭弹窗
  const mask = ev.target.closest('[data-mask]');
  if (mask && ev.target === mask) {
    state.modal = null; render(); return;
  }
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');

  switch (action) {
    case 'logout':
      state.modal = {
        type: 'confirm',
        titleKey: 'modal.logout.title',
        body: t('modal.logout.body'),
        confirmKey: 'modal.logout.confirm',
        action: 'confirm-logout',
      };
      render();
      break;
    case 'confirm-logout':
      session = null;
      state.bulkSelected.clear();
      state.trashSelected.clear();
      save(KEY.session, null);
      state.modal = null;
      state.loginError = '';
      go('#/');
      render();
      toast(t('toast.loggedOut'));
      break;
    case 'set-lang':
      setLang(el.getAttribute('data-lang'));
      break;
    case 'sync-now':
      resetSyncRetries();
      sync.status = 'loading';
      render();
      if (sync.dirty) { pushRemote(); toast(t('sync.loading')); }
      else { toast(t('sync.loading')); pullRemote(); }
      break;
    case 'new-matter':
      state.modal = { type: 'new-matter' }; render(); break;
    case 'close-modal':
      state.modal = null; render(); break;
    case 'open-matter':
      go(`#/matters/${el.getAttribute('data-id')}`); break;
    case 'chat-matter': {
      const m = matterById(el.getAttribute('data-id'));
      if (m && canSee(currentUser(), m)) { state.modal = { type: 'chat', matterId: m.id }; render(); }
      break;
    }
    case 'mark-read':
      if (markNotificationRead(el.getAttribute('data-id'), currentUser().id)) {
        render();
        toast(t('toast.markedRead'));
        // 已读回执要尽快到达发送者；不要依赖浏览器稍后执行的后台计时器。
        pushRemote();
      }
      break;
    case 'delete-notification':
      state.modal = {
        type: 'confirm', titleKey: 'modal.deleteNotification.title', body: t('modal.deleteNotification.body'),
        confirmKey: 'modal.deleteNotification.confirm', action: 'confirm-delete-notification', id: el.getAttribute('data-id'),
        danger: true,
      };
      render();
      break;
    case 'confirm-delete-notification':
      if (deleteNotificationForUser(el.getAttribute('data-id'), currentUser().id)) {
        state.modal = null;
        render();
        toast(t('toast.notificationDeleted'));
      }
      break;
    case 'enable-system-notifications':
      enableSystemNotifications();
      break;
    case 'disable-system-notifications':
      state.modal = {
        type: 'confirm', titleKey: 'modal.disableSystem.title', body: t('modal.disableSystem.body'),
        confirmKey: 'modal.disableSystem.confirm', action: 'confirm-disable-system-notifications',
      };
      render();
      break;
    case 'confirm-disable-system-notifications':
      systemNotice.enabled = false;
      save(KEY.systemEnabled, false);
      state.modal = null;
      render();
      toast(t('toast.systemDisabled'));
      break;
    case 'save-matter':
      saveMatterFromDom(el.getAttribute('data-id')); break;
    case 'undo-matter-edit': {
      const m = matterById(el.getAttribute('data-id'));
      const edit = m && lastMatterEditLog(m);
      if (!m || !edit) { toast(t('toast.noEditToUndo')); break; }
      if (!canUndoMatterEdit(currentUser(), edit)) {
        state.modal = {
          type: 'notice', titleKey: 'modal.denyUndoEdit.title',
          body: esc(t('modal.denyUndoEdit.body', { name: (USER[edit.by] || {}).name || edit.by })),
        };
      } else {
        state.modal = {
          type: 'confirm', titleKey: 'modal.undoEdit.title',
          body: t('modal.undoEdit.body', { name: (USER[edit.by] || {}).name || edit.by, when: fmtStamp(edit.at) }),
          confirmKey: 'modal.undoEdit.confirm', action: 'confirm-undo-matter-edit', id: m.id,
        };
      }
      render();
      break;
    }
    case 'confirm-undo-matter-edit':
      if (undoMatterEdit(el.getAttribute('data-id'))) { state.modal = null; render(); }
      break;
    case 'add-file': {
      state.modal = { type: 'file', matterId: el.getAttribute('data-id') };
      render();
      break;
    }
    case 'remove-file': {
      const id = el.getAttribute('data-id'); const i = Number(el.getAttribute('data-idx'));
      const m = matterById(id);
      const f = m.files[i];
      m.files.splice(i, 1);
      addLogKey(id, currentUser().id, 'detail.entry.fileRemove', { name: f.name }, {
        key: 'inbox.fileRemove', vars: noticeVars(m, currentUser().id, { name: f.name }),
      });
      commit(); render();
      break;
    }
    case 'clear-filters':
      state.filters = { q: '', area: '', owner: '', status: '', waiting: '' }; render(); break;
    case 'export-csv':
      state.modal = {
        type: 'confirm',
        titleKey: 'modal.export.title',
        body: t('modal.export.body'),
        confirmKey: 'modal.export.confirm',
        action: 'confirm-export',
        id: el.getAttribute('data-id'),
      };
      render();
      break;
    case 'confirm-export': {
      const id = el.getAttribute('data-id');
      state.modal = null;
      render();
      exportCSV(id);
      break;
    }
    case 'print':
      window.print(); break;
    case 'download-import-sample': {
      const heads = ['客户','事项名称','业务类型','当前阶段','状态','截止日期','等待谁','现在要做什么','负责人'];
      const csv = '\ufeff' + heads.map(x => `"${x}"`).join(',') + '\n';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '事项导入示例.csv'; a.click(); URL.revokeObjectURL(a.href);
      state.modal = null; render();
      break;
    }
    case 'toggle-bulk-matter': {
      const id = String(el.getAttribute('data-id'));
      const m = matterById(id);
      if (!m || (currentUser().id !== m.owner && !isAdmin())) break;
      if (el.checked) state.bulkSelected.add(id); else state.bulkSelected.delete(id);
      render();
      break;
    }
    case 'toggle-all-bulk-matters': {
      const selectable = sorted(filterMatters()).filter(m => currentUser().id === m.owner || isAdmin());
      const selectAll = selectable.length > 0 && !selectable.every(m => state.bulkSelected.has(String(m.id)));
      selectable.forEach(m => selectAll ? state.bulkSelected.add(String(m.id)) : state.bulkSelected.delete(String(m.id)));
      render();
      break;
    }
    case 'bulk-delete-matters': {
      const ids = [...state.bulkSelected].filter(id => {
        const m = matterById(id);
        return m && !m.deletedAt && canSee(currentUser(), m) && (currentUser().id === m.owner || isAdmin());
      });
      if (!ids.length) break;
      state.modal = {
        type: 'confirm', titleKey: 'modal.bulkDelete.title', body: t('modal.bulkDelete.body', { n: ids.length }),
        confirmText: t('modal.bulkDelete.confirm', { n: ids.length }), action: 'confirm-bulk-delete-matters', ids, danger: true,
      };
      render();
      break;
    }
    case 'confirm-bulk-delete-matters': {
      const ids = (state.modal && state.modal.ids || []).filter(id => {
        const m = matterById(id);
        return m && !m.deletedAt && canSee(currentUser(), m) && (currentUser().id === m.owner || isAdmin());
      });
      ids.forEach(id => {
        const m = matterById(id);
        m.deletedAt = Date.now();
        addLogKey(id, currentUser().id, 'detail.entry.deleted', {}, {
          key: 'inbox.deleted', vars: noticeVars(m, currentUser().id),
        });
        state.bulkSelected.delete(String(id));
      });
      if (ids.length) commit();
      state.modal = null;
      render();
      if (ids.length) toast(t('toast.bulkDeleted', { n: ids.length }));
      break;
    }
    case 'delete-matter': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (!canSee(currentUser(), m)) break;
      if (currentUser().id !== m.owner && !isAdmin()) {
        state.modal = {
          type: 'notice',
          titleKey: 'modal.denyDelete.title',
          body: t('modal.denyDelete.body', { name: esc((USER[m.owner] || {}).name || m.owner) }),
        };
        render();
        break;
      }
      const adminNote = (isAdmin() && currentUser().id !== m.owner)
        ? t('modal.delete.adminNote', { name: (USER[m.owner] || {}).name || m.owner }) : '';
      state.modal = {
        type: 'confirm',
        titleKey: 'modal.delete.title',
        body: t('modal.delete.body', { no: m.no, title: L(m.title) }) + adminNote,
        confirmKey: 'modal.delete.confirm',
        danger: true,
        action: 'confirm-delete-matter',
        id: m.id,
      };
      render();
      break;
    }
    case 'confirm-delete-matter': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (currentUser().id !== m.owner && !isAdmin()) { toast(t('toast.onlyOwnerDelete', { name: (USER[m.owner] || {}).name || m.owner })); break; }
      m.deletedAt = Date.now();
      addLogKey(id, currentUser().id, 'detail.entry.deleted', {}, {
        key: 'inbox.deleted', vars: noticeVars(m, currentUser().id),
      });
      commit();
      state.modal = null;
      go('#/matters');
      render();
      toast(t('toast.deleted', { no: m.no }));
      break;
    }
    case 'complete-step': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (!canSee(currentUser(), m)) break;
      if (!isStepOwner(currentUser(), m) && !isAdmin()) {
        state.modal = {
          type: 'notice',
          titleKey: 'modal.denyStep.title',
          body: t('modal.denyStep.body', {
            name: esc((USER[m.nextOwner] || {}).name || m.nextOwner),
            next: esc(L(m.next)),
          }),
        };
        render();
        break;
      }
      state.modal = { type: 'complete-step', matterId: m.id };
      render();
      break;
    }
    case 'undo-step': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m || !canSee(currentUser(), m)) break;
      const s = lastStep(m);
      if (!s) { toast(t('toast.noSteps')); break; }
      if (!canUndoStep(currentUser(), m)) {
        state.modal = {
          type: 'notice',
          titleKey: 'modal.denyUndo.title',
          body: t('modal.denyUndo.body', { name: esc((USER[s.by] || {}).name || s.by) }),
        };
        render();
        break;
      }
      state.modal = {
        type: 'confirm',
        titleKey: 'modal.undo.title',
        body: t('modal.undo.body', {
          text: L(s.text),
          owner: (USER[s.owner] || {}).name || s.owner,
          due: fmtDate(s.due),
        }),
        confirmKey: 'modal.undo.confirm',
        action: 'confirm-undo-step',
        id: m.id,
      };
      render();
      break;
    }
    case 'confirm-undo-step': {
      if (undoStep(el.getAttribute('data-id'))) { state.modal = null; render(); }
      break;
    }
    case 'restore-matter': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (currentUser().id !== m.owner) { toast(t('toast.adminRestore', { name: (USER[m.owner] || {}).name || m.owner })); break; }
      m.deletedAt = null;
      state.trashSelected.delete(String(id));
      addLogKey(id, currentUser().id, 'detail.entry.restored', {}, {
        key: 'inbox.restored', vars: noticeVars(m, currentUser().id),
      });
      commit();
      go(`#/matters/${m.id}`);
      render();
      toast(t('toast.restored', { no: m.no }));
      break;
    }
    case 'purge-matter': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (currentUser().id !== m.owner) { toast(t('toast.adminPurge', { name: (USER[m.owner] || {}).name || m.owner })); break; }
      state.modal = {
        type: 'confirm',
        titleKey: 'modal.purge.title',
        body: t('modal.purge.body', { no: m.no, title: L(m.title) }),
        confirmKey: 'modal.purge.confirm',
        danger: true,
        action: 'confirm-purge-matter',
        id: m.id,
      };
      render();
      break;
    }
    case 'toggle-trash-matter': {
      const id = String(el.getAttribute('data-id'));
      const m = matterById(id);
      if (!m || !m.deletedAt || currentUser().id !== m.owner) break;
      if (el.checked) state.trashSelected.add(id); else state.trashSelected.delete(id);
      render();
      break;
    }
    case 'toggle-all-trash': {
      const selectable = trashedMatters().filter(m => currentUser().id === m.owner);
      const selectAll = selectable.length > 0 && !selectable.every(m => state.trashSelected.has(String(m.id)));
      selectable.forEach(m => selectAll ? state.trashSelected.add(String(m.id)) : state.trashSelected.delete(String(m.id)));
      render();
      break;
    }
    case 'bulk-purge-trash': {
      const ids = [...state.trashSelected].filter(id => {
        const m = matterById(id);
        return m && m.deletedAt && currentUser().id === m.owner;
      });
      if (!ids.length) break;
      state.modal = {
        type: 'confirm', titleKey: 'modal.bulkPurge.title', body: t('modal.bulkPurge.body', { n: ids.length }),
        confirmText: t('modal.bulkPurge.confirm', { n: ids.length }), action: 'confirm-bulk-purge-trash', ids, danger: true,
      };
      render();
      break;
    }
    case 'confirm-bulk-purge-trash': {
      const ids = (state.modal && state.modal.ids || []).filter(id => {
        const m = matterById(id);
        return m && m.deletedAt && currentUser().id === m.owner;
      });
      ids.forEach(id => { sync.purged.add(String(id)); state.trashSelected.delete(String(id)); });
      if (ids.length) {
        const idSet = new Set(ids.map(String));
        matters = matters.filter(m => !idSet.has(String(m.id)));
        logs = logs.filter(l => !idSet.has(String(l.matterId)));
        commit();
      }
      state.modal = null;
      render();
      if (ids.length) toast(t('toast.bulkPurged', { n: ids.length }));
      break;
    }
    case 'confirm-purge-matter': {
      const id = el.getAttribute('data-id');
      const m = matterById(id);
      if (!m) break;
      if (currentUser().id !== m.owner) { toast(t('toast.adminPurge', { name: (USER[m.owner] || {}).name || m.owner })); break; }
      sync.purged.add(String(id));
      state.trashSelected.delete(String(id));
      matters = matters.filter(x => String(x.id) !== String(id));
      logs = logs.filter(l => String(l.matterId) !== String(id));
      commit();
      state.modal = null;
      render();
      toast(t('toast.purged'));
      break;
    }
  }
});

document.addEventListener('change', ev => {
  // 业务类型 / 阶段 / 等待谁 选了「自定义…」就露出输入框
  const custom = ev.target.closest('[data-custom-select]');
  if (custom) {
    const box = custom.parentElement;
    const input = box ? box.querySelector('.custom-input') : null;
    if (input) {
      const on = custom.value === '__custom__';
      input.style.display = on ? '' : 'none';
      if (on) input.focus();
    }
    if (!ev.target.closest('[data-area-picker]')) return;
  }
  // 换业务类型 → 自动套用该类事项的默认项目成员
  const picker = ev.target.closest('[data-area-picker]');
  if (picker) {
    const ids = defaultTeam(picker.value);
    const scope = picker.closest('[data-matter]') || picker.closest('form') || document;
    scope.querySelectorAll('[data-field="team"], [name="team"]').forEach(cb => { cb.checked = ids.includes(cb.value); });
    if ((AREA[picker.value] || {}).members) toast(t('toast.areaDefault'));
    return;
  }
  const el = ev.target.closest('[data-filter]');
  if (!el) return;
  state.filters[el.getAttribute('data-filter')] = el.value;
  const tbody = document.getElementById('matter-rows');
  const empty = document.getElementById('matter-empty');
  if (tbody) {
    tbody.innerHTML = matterRowsHTML();
    if (empty) empty.style.display = filterMatters().length ? 'none' : '';
  }
});

document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-filter="q"]');
  if (!el) return;
  state.filters.q = el.value;
  const tbody = document.getElementById('matter-rows');
  const empty = document.getElementById('matter-empty');
  if (tbody) {
    tbody.innerHTML = matterRowsHTML();
    if (empty) empty.style.display = filterMatters().length ? 'none' : '';
  }
});

document.addEventListener('submit', ev => {
  const form = ev.target.closest('form[data-action]');
  if (!form) return;
  ev.preventDefault();
  const action = form.getAttribute('data-action');
  if (action === 'login') {
    const email = (form.email.value || '').trim().toLowerCase();
    const pass = form.password.value || '';
    const user = USERS.find(u => u.email.toLowerCase() === email);
    if (!user || pass !== user.password) {
      state.loginError = !user ? t('login.errNoUser') : t('login.errBadPass');
      render();
      return;
    }
    state.loginError = '';
    session = { userId: user.id }; state.bulkSelected.clear(); state.trashSelected.clear(); save(KEY.session, session);
    go('#/'); render();
    toast(t('toast.welcome', { name: user.name.split(' ')[0] }));
    return;
  }
  if (action === 'import-file') {
    const file = form.importFile && form.importFile.files && form.importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let rows;
        if (/\.xlsx?$/i.test(file.name)) {
          if (!globalThis.XLSX) throw new Error('Excel parser unavailable');
          const wb = XLSX.read(reader.result, { type: 'array' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        } else {
          const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
          const parse = line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(x => x.replace(/^\"|\"$/g, '').replace(/\"\"/g, '\"').trim());
          const heads = parse(lines.shift()); rows = lines.map(line => Object.fromEntries(parse(line).map((v, i) => [heads[i], v])));
        }
        const aliases = { client:['客户','client'], title:['事项名称','事项','matter name','title'], area:['业务类型','practice area','area'], stage:['当前阶段','stage'], status:['状态','status'], due:['截止日期','截止','due date','due'], waiting:['等待谁','waiting for','waiting'], next:['现在要做什么','当前步骤','下一步','next step','next'], owner:['负责人','owner'] };
        const val = (row, keys) => { const key = Object.keys(row).find(k => keys.some(a => k.trim().toLowerCase() === a.toLowerCase())); return key ? String(row[key] || '').trim() : ''; };
        const requiredHeaders = ['client','title','next','due'];
        const headersPresent = Object.keys(rows[0] || {}).map(k => k.trim().toLowerCase());
        const headerAliases = { client:['客户','client'], title:['事项名称','事项','matter name','title'], next:['现在要做什么','当前步骤','下一步','next step','next'], due:['截止日期','截止','due date','due'] };
        const validFormat = rows.length > 0 && requiredHeaders.every(name => headerAliases[name].some(alias => headersPresent.includes(alias.toLowerCase())));
        if (!validFormat) { state.modal = { type: 'import-invalid' }; render(); return; }
        let ok = 0, bad = 0;
        rows.forEach(row => { const d = {}; Object.keys(aliases).forEach(k => d[k] = val(row, aliases[k])); d.owner = USERS.find(u => u.name === d.owner || u.id === d.owner)?.id || currentUser().id; d.nextOwner = d.owner; d.status = ['red','yellow','green'].includes(d.status) ? d.status : 'green'; d.area = d.area || 'other'; d.stage = d.stage || STAGES[0]; d.waiting = d.waiting || 'none'; if (d.client && d.title && d.next && d.due && createMatter(d)) ok++; else bad++; });
        state.modal = null; render(); toast(t('modal.import.result', { ok, bad }));
      } catch (e) { state.modal = { type:'notice', titleKey:'modal.import.title', body: esc(String(e.message || e)) }; render(); }
    };
    if (/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file); else reader.readAsText(file);
  }
  if (action === 'create-matter') {
    const data = readForm(form);
    const m = createMatter(data);
    if (m) { state.modal = null; go(`#/matters/${m.id}`); render(); }
  }
  if (action === 'confirm-add-file') {
    const id = form.getAttribute('data-id');
    const name = (form.fileName.value || '').trim();
    const url = (form.fileUrl.value || '').trim();
    if (!name) { toast(t('toast.needFileName')); return; }
    const m = matterById(id);
    if (!m) return;
    m.files = m.files || [];
    m.files.push({ name, url: url || '#' });
    addLogKey(id, currentUser().id, 'detail.entry.fileAdd', { name }, {
      key: 'inbox.fileAdd', vars: noticeVars(m, currentUser().id, { name }),
    });
    commit();
    state.modal = null;
    render();
    toast(t('toast.fileAdded'));
  }
  if (action === 'confirm-complete-step') {
    const ok = completeStep(form.getAttribute('data-id'), readForm(form));
    if (ok) { state.modal = null; render(); }
  }
  if (action === 'send-chat') {
    const id = form.getAttribute('data-id');
    const m = matterById(id);
    const message = String((form.message && form.message.value) || '').trim();
    const recipients = [...form.querySelectorAll('input[name="chatTo"]:checked')].map(x => x.value);
    if (!m || !canSee(currentUser(), m)) return;
    if (!message) { toast(t('toast.needMessage')); return; }
    if (!recipients.length) { toast(t('toast.needChatRecipient')); return; }
    addLogKey(id, currentUser().id, 'detail.entry.chat', { message }, {
      key: 'inbox.chat', vars: noticeVars(m, currentUser().id, { message }), to: recipients,
    });
    commit();
    state.modal = null;
    render();
    toast(t('toast.chatSent'));
  }
});

window.addEventListener('hashchange', render);

// 按 Esc 关掉弹窗
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && state.modal) { state.modal = null; render(); }
});

/* ------------------------------ 启动 ------------------------------ */

// 本地还没有缓存时，从空列表开始；联网后会拉取团队数据。
if (!load(KEY.matters, null)) {
  save(KEY.matters, matters);
  save(KEY.logs, logs);
  save(KEY.seq, seq);
}
render();

if (REMOTE_ENABLED) {
  pullRemote({ initial: true });
  setInterval(() => {
    if (!sync.dirty && sync.status !== 'error') pullRemote({ background: true });
  }, SYNC_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !sync.dirty) pullRemote({ background: true });
  });
  window.addEventListener('online', () => {
    resetSyncRetries();
    if (sync.dirty) pushRemote(); else pullRemote({ background: true });
  });
}
