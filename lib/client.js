(function () {
  'use strict';

  function initModule(require, module, exports) {
    var React = require('react');
    var ReactDOM = require('react-dom/client');

    var CSS_ID = 'dsh-notion-styles';
    var CSS = [
      '/* Notion 侧边栏条目样式，100%对齐原生 DSH 与皮肤 */',
      '[data-dsh-notion-entry] {',
      '  box-sizing: border-box;',
      '  width: 100%;',
      '  min-height: 36px;',
      '  color: var(--dsw-alias-label-secondary, #4d5d7f);',
      '  white-space: nowrap;',
      '  cursor: pointer;',
      '  background: transparent;',
      '  border: none;',
      '  border-radius: 8px;',
      '  align-items: center;',
      '  gap: 10px;',
      '  padding: 0 10px;',
      '  font-size: 13px;',
      '  display: flex;',
      '  margin-bottom: 2px;',
      '  transition: background 0.15s ease, color 0.15s ease;',
      '}',
      '[data-dsh-notion-entry]:hover {',
      '  color: var(--dsw-alias-label-primary, #172347);',
      '  background: var(--dsw-alias-interactive-bg-hover, rgba(103, 126, 183, 0.12));',
      '}',
      '[data-dsh-notion-entry][data-active] {',
      '  color: var(--dsw-alias-label-primary, #172347);',
      '  background: var(--dsw-alias-interactive-bg-active, rgba(197, 164, 104, 0.24));',
      '  font-weight: 600;',
      '}',
      '[data-dsh-notion-entry] .notion-icon-wrap {',
      '  flex: none;',
      '  justify-content: center;',
      '  align-items: center;',
      '  width: 24px;',
      '  height: 24px;',
      '  display: inline-flex;',
      '}',
      '[data-dsh-notion-entry] .notion-label-text {',
      '  text-overflow: ellipsis;',
      '  overflow: hidden;',
      '}',
      '[data-dsh-frame][data-sidebar-collapsed] [data-dsh-notion-entry] {',
      '  border-radius: 50%;',
      '  justify-content: center;',
      '  width: 36px;',
      '  min-height: 36px;',
      '  margin: 0 auto 8px;',
      '  padding: 0;',
      '}',
      '[data-dsh-frame][data-sidebar-collapsed] [data-dsh-notion-entry] .notion-label-text {',
      '  display: none;',
      '}',
      '/* Notion 中央面板：继承 DSH 主题变量与毛玻璃质感，跟随当前浅色/女仆/深色自适应 */',
      '[data-dsh-notion-view] {',
      '  z-index: 60;',
      '  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base, #f8faff));',
      '  backdrop-filter: blur(12px) saturate(0.95);',
      '  color: var(--dsw-alias-label-primary, #172347);',
      '  display: none;',
      '  position: absolute;',
      '  inset: 0;',
      '  overflow: hidden;',
      '}',
      'html[data-dsh-notion-active] [data-dsh-notion-view] {',
      '  display: flex !important;',
      '  flex-direction: column;',
      '}',
      'html[data-dsh-notion-active] [data-pane="conversation"] > :not([data-dsh-notion-view]),',
      'html[data-dsh-notion-active] [class*="centerCol"] > :not([data-dsh-notion-view]) {',
      '  display: none !important;',
      '}'
    ].join('\n');

    var NOTION_ICON = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M2.5 1.5A1.5 1.5 0 0 1 4 0h8a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 12 16H4a1.5 1.5 0 0 1-1.5-1.5v-13zm2 .5v12h7V2H4.5zm1.5 2h4v1.5H6V4zm0 3h4v1.5H6V7zm0 3h2.5v1.5H6V10z"/></svg>';

    function injectStyles() {
      if (document.getElementById(CSS_ID)) return;
      var styleEl = document.createElement('style');
      styleEl.id = CSS_ID;
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }

    function parseJsonResponse(res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || ('请求失败 (' + res.status + ')'));
        return data;
      });
    }

    function NotionPanel(props) {
      var onClose = props.onClose;
      var tabState = React.useState('resources');
      var tab = tabState[0];
      var setTab = tabState[1];

      var configState = React.useState({ apiKeyMasked: '', defaultDatabaseId: '', defaultParentPageId: '', hasKey: false });
      var config = configState[0];
      var setConfig = configState[1];

      var apiKeyInputState = React.useState('');
      var apiKeyInput = apiKeyInputState[0];
      var setApiKeyInput = apiKeyInputState[1];

      var defaultDbInputState = React.useState('');
      var defaultDbInput = defaultDbInputState[0];
      var setDefaultDbInput = defaultDbInputState[1];

      var defaultPageInputState = React.useState('');
      var defaultPageInput = defaultPageInputState[0];
      var setDefaultPageInput = defaultPageInputState[1];

      var testResultState = React.useState(null);
      var testResult = testResultState[0];
      var setTestResult = testResultState[1];

      var loadingState = React.useState(false);
      var loading = loadingState[0];
      var setLoading = loadingState[1];

      var resourcesState = React.useState([]);
      var resources = resourcesState[0];
      var setResources = resourcesState[1];

      var selectedItemState = React.useState(null);
      var selectedItem = selectedItemState[0];
      var setSelectedItem = selectedItemState[1];

      var pageDetailState = React.useState(null);
      var pageDetail = pageDetailState[0];
      var setPageDetail = pageDetailState[1];

      var databaseRowsState = React.useState([]);
      var databaseRows = databaseRowsState[0];
      var setDatabaseRows = databaseRowsState[1];

      var databaseSchemaState = React.useState(null);
      var databaseSchema = databaseSchemaState[0];
      var setDatabaseSchema = databaseSchemaState[1];

      var editingRowIdState = React.useState(null); // 'new' 或 row.id
      var editingRowId = editingRowIdState[0];
      var setEditingRowId = editingRowIdState[1];

      var editingRowValuesState = React.useState({});
      var editingRowValues = editingRowValuesState[0];
      var setEditingRowValues = editingRowValuesState[1];

      var showAddColModalState = React.useState(false);
      var showAddColModal = showAddColModalState[0];
      var setShowAddColModal = showAddColModalState[1];

      var newColNameState = React.useState('');
      var newColName = newColNameState[0];
      var setNewColName = newColNameState[1];

      var newColTypeState = React.useState('rich_text');
      var newColType = newColTypeState[0];
      var setNewColType = newColTypeState[1];

      var showCreateTableModalState = React.useState(false);
      var showCreateTableModal = showCreateTableModalState[0];
      var setShowCreateTableModal = showCreateTableModalState[1];

      var showCreatePageModalState = React.useState(false);
      var showCreatePageModal = showCreatePageModalState[0];
      var setShowCreatePageModal = showCreatePageModalState[1];

      var newTableNameState = React.useState('');
      var newTableName = newTableNameState[0];
      var setNewTableName = newTableNameState[1];

      var newPageNameState = React.useState('');
      var newPageName = newPageNameState[0];
      var setNewPageName = newPageNameState[1];

      var newPageDescState = React.useState('');
      var newPageDesc = newPageDescState[0];
      var setNewPageDesc = newPageDescState[1];

      var resourceFilterTypeState = React.useState('all'); // 'all' | 'page' | 'database'
      var resourceFilterType = resourceFilterTypeState[0];
      var setResourceFilterType = resourceFilterTypeState[1];

      var tableFilterTextState = React.useState('');
      var tableFilterText = tableFilterTextState[0];
      var setTableFilterText = tableFilterTextState[1];

      var newTitleState = React.useState('');
      var newTitle = newTitleState[0];
      var setNewTitle = newTitleState[1];

      var newContentState = React.useState('');
      var newContent = newContentState[0];
      var setNewContent = newContentState[1];

      var newBlockTypeState = React.useState('paragraph');
      var newBlockType = newBlockTypeState[0];
      var setNewBlockType = newBlockTypeState[1];

      var editingBlockIdState = React.useState(null);
      var editingBlockId = editingBlockIdState[0];
      var setEditingBlockId = editingBlockIdState[1];

      var editingBlockTextState = React.useState('');
      var editingBlockText = editingBlockTextState[0];
      var setEditingBlockText = editingBlockTextState[1];

      var isEditingTitleState = React.useState(false);
      var isEditingTitle = isEditingTitleState[0];
      var setIsEditingTitle = isEditingTitleState[1];

      // 全量 Markdown 编辑与即时渲染状态
      var pageMarkdownState = React.useState('');
      var pageMarkdown = pageMarkdownState[0];
      var setPageMarkdown = pageMarkdownState[1];

      var pageTitleEditState = React.useState('');
      var pageTitleEdit = pageTitleEditState[0];
      var setPageTitleEdit = pageTitleEditState[1];

      var autoSaveStatusState = React.useState('saved'); // 'saved' | 'saving' | 'dirty' | 'error'
      var autoSaveStatus = autoSaveStatusState[0];
      var setAutoSaveStatus = autoSaveStatusState[1];

      var lastSavedMdRef = React.useRef('');
      var lastSavedTitleRef = React.useRef('');
      var autoSaveTimerRef = React.useRef(null);
      var draftRef = React.useRef({ item: null, markdown: '', title: '' });
      var openRequestRef = React.useRef(0);
      var viewModeState = React.useState('edit'); // 'edit' (即时输入并排版渲染) | 'preview'
      var viewMode = viewModeState[0];
      var setViewMode = viewModeState[1];

      var fetchConfig = function () {
        fetch('/api/dsh-notion/config')
          .then(parseJsonResponse)
          .then(function (data) {
            setConfig(data);
            setDefaultDbInput(data.defaultDatabaseId || '');
            setDefaultPageInput(data.defaultParentPageId || '');
          })
          .catch(function (err) { console.error(err); });
      };

      var loadResources = function () {
        setLoading(true);
        fetch('/api/dsh-notion/resources')
          .then(parseJsonResponse)
          .then(function (data) {
            setResources(data.results || []);
          })
          .catch(function (err) { console.error(err); })
          .finally(function () { setLoading(false); });
      };

      React.useEffect(function () {
        fetchConfig();
        loadResources();
      }, []);

      var saveSettings = function () {
        setLoading(true);
        fetch('/api/dsh-notion/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: apiKeyInput,
            defaultParentPageId: defaultPageInput,
            defaultDatabaseId: defaultDbInput
          })
        })
          .then(parseJsonResponse)
          .then(function () {
            fetchConfig();
            setApiKeyInput('');
            alert('Notion 连接配置已保存！');
          })
          .catch(function (err) { alert('保存失败: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var testConnection = function () {
        setLoading(true);
        setTestResult(null);
        fetch('/api/dsh-notion/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: apiKeyInput.trim() || undefined,
            defaultParentPageId: defaultPageInput.trim() || undefined
          })
        })
          .then(parseJsonResponse)
          .then(function (data) { setTestResult(data); })
          .catch(function (err) { setTestResult({ success: false, error: err.message }); })
          .finally(function () { setLoading(false); });
      };

      var blocksToMarkdown = function (blocks) {
        if (!blocks || !blocks.length) return '';
        var lines = [];
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          var raw = (b[b.type] && b[b.type].rich_text && b[b.type].rich_text.map(function (t) { return t.plain_text; }).join('')) || '';
          if (b.type === 'heading_1') lines.push('# ' + raw);
          else if (b.type === 'heading_2') lines.push('## ' + raw);
          else if (b.type === 'heading_3') lines.push('### ' + raw);
          else if (b.type === 'bulleted_list_item') lines.push('- ' + raw);
          else if (b.type === 'numbered_list_item') lines.push('1. ' + raw);
          else if (b.type === 'to_do') lines.push((b.to_do && b.to_do.checked ? '- [x] ' : '- [ ] ') + raw);
          else if (b.type === 'quote') lines.push('> ' + raw);
          else if (b.type === 'code') {
            var lang = (b.code && b.code.language) || '';
            lines.push('```' + (lang === 'plain text' ? '' : lang) + '\n' + raw + '\n```');
          } else {
            lines.push(raw);
          }
        }
        return lines.join('\n\n');
      };

      var performSaveNow = function (mdContent, titleVal, immediate) {
        if (!selectedItem) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setAutoSaveStatus('saving');
        fetch('/api/dsh-notion/sync-page-markdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: selectedItem.id,
            markdown: mdContent,
            title: titleVal,
            immediate: Boolean(immediate)
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              lastSavedMdRef.current = mdContent;
              lastSavedTitleRef.current = titleVal;
              if (immediate) {
                setAutoSaveStatus('synced');
              } else {
                setAutoSaveStatus('cached');
              }
            } else {
              setAutoSaveStatus('error');
            }
          })
          .catch(function () {
            setAutoSaveStatus('error');
          });
      };

      var triggerAutoSave = function (mdContent, titleVal) {
        if (!selectedItem) return;
        draftRef.current = { item: selectedItem, markdown: mdContent, title: titleVal };
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        setAutoSaveStatus('dirty');

        autoSaveTimerRef.current = setTimeout(function () {
          if (mdContent === lastSavedMdRef.current && titleVal === lastSavedTitleRef.current) {
            setAutoSaveStatus('synced');
            return;
          }
          performSaveNow(mdContent, titleVal, false);
        }, 500); // 500ms 即时沉淀到本地持久化缓存，后台防抖队列自动送往 Notion
      };

      React.useEffect(function () {
        return function () {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          var draft = draftRef.current;
          if (draft.item && (draft.markdown !== lastSavedMdRef.current || draft.title !== lastSavedTitleRef.current)) {
            fetch('/api/dsh-notion/sync-page-markdown', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageId: draft.item.id, markdown: draft.markdown, title: draft.title, immediate: false }),
              keepalive: true
            }).catch(function () {});
          }
        };
      }, []);

      var openItem = function (item) {
        var draft = draftRef.current;
        if (autoSaveTimerRef.current && draft.item && draft.item.id !== item.id) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
          performSaveNow(draft.markdown, draft.title, false);
        }
        var requestId = ++openRequestRef.current;
        setSelectedItem(item);
        setLoading(true);
        setEditingRowId(null);
        setEditingRowValues({});
        setTableFilterText('');
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        if (item.object === 'database') {
          setTab('table');
          fetch('/api/dsh-notion/query-database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ databaseId: item.id })
          })
            .then(parseJsonResponse)
            .then(function (data) {
              if (requestId !== openRequestRef.current) return;
              setDatabaseRows(data.results || []);
              setDatabaseSchema(data.database ? data.database.properties : null);
            })
            .catch(function (err) { alert('读取数据库表格失败: ' + err.message); })
            .finally(function () { setLoading(false); });
        } else {
          setTab('page');
          fetch('/api/dsh-notion/page-content?pageId=' + item.id)
            .then(parseJsonResponse)
            .then(function (data) {
              if (requestId !== openRequestRef.current) return;
              setPageDetail(data);
              var pt = '无标题';
              if (data.page && data.page.properties) {
                var p = data.page.properties.title || Object.values(data.page.properties).find(function (x) { return x.type === 'title'; });
                if (p && p.title) pt = p.title.map(function (part) { return part.plain_text || ''; }).join('') || pt;
              }
              var md = data.markdown !== undefined ? data.markdown : blocksToMarkdown(data.blocks || []);
              setPageTitleEdit(pt);
              setPageMarkdown(md);
              lastSavedTitleRef.current = pt;
              lastSavedMdRef.current = md;
              draftRef.current = { item: item, markdown: md, title: pt };
              setAutoSaveStatus(data.syncedToNotion ? 'synced' : 'cached');
            })
            .catch(function (err) { alert('读取页面内容失败: ' + err.message); })
            .finally(function () { setLoading(false); });
        }
      };

      var reloadCurrentItem = function () {
        if (!selectedItem) return;
        if (selectedItem.object === 'database') {
          setLoading(true);
          fetch('/api/dsh-notion/query-database', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ databaseId: selectedItem.id })
          })
            .then(parseJsonResponse)
            .then(function (data) {
              setDatabaseRows(data.results || []);
              setDatabaseSchema(data.database ? data.database.properties : null);
            })
            .catch(function (err) { alert('刷新数据库失败: ' + err.message); })
            .finally(function () { setLoading(false); });
        } else {
          setLoading(true);
          fetch('/api/dsh-notion/page-content?pageId=' + selectedItem.id)
            .then(parseJsonResponse)
            .then(function (data) {
              setPageDetail(data);
              var pt = '无标题';
              if (data.page && data.page.properties) {
                var p = data.page.properties.title || Object.values(data.page.properties).find(function (x) { return x.type === 'title'; });
                if (p && p.title) pt = p.title.map(function (part) { return part.plain_text || ''; }).join('') || pt;
              }
              var md = data.markdown !== undefined ? data.markdown : blocksToMarkdown(data.blocks || []);
              setPageTitleEdit(pt);
              setPageMarkdown(md);
              lastSavedTitleRef.current = pt;
              lastSavedMdRef.current = md;
              draftRef.current = { item: selectedItem, markdown: md, title: pt };
              setAutoSaveStatus(data.syncedToNotion ? 'synced' : 'cached');
            })
            .catch(function (err) { alert('刷新页面内容失败: ' + err.message); })
            .finally(function () { setLoading(false); });
        }
      };

      var handleSaveRow = function () {
        if (!selectedItem || !selectedItem.id) return;
        setLoading(true);
        var isNew = editingRowId === 'new';
        fetch('/api/dsh-notion/update-database-row', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId: isNew ? undefined : editingRowId,
            databaseId: selectedItem.id,
            properties: editingRowValues
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setEditingRowId(null);
              setEditingRowValues({});
              reloadCurrentItem();
            } else {
              alert('保存记录失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求异常: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleAddColumn = function () {
        if (!newColName.trim()) {
          alert('请输入列名称');
          return;
        }
        if (!selectedItem || !selectedItem.id) return;
        setLoading(true);
        fetch('/api/dsh-notion/add-database-column', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            databaseId: selectedItem.id,
            name: newColName.trim(),
            type: newColType
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setShowAddColModal(false);
              setNewColName('');
              reloadCurrentItem();
            } else {
              alert('添加新列失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求异常: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleCreateNewPage = function () {
        if (!newPageName.trim()) {
          alert('请输入页面名称/标题');
          return;
        }
        setLoading(true);
        fetch('/api/dsh-notion/create-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newPageName.trim(),
            content: newPageDesc.trim() || '# ' + newPageName.trim() + '\n\n在此开始编写内容...',
            isDatabase: false
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setShowCreatePageModal(false);
              setNewPageName('');
              setNewPageDesc('');
              alert('新建页面成功！');
              loadResources();
              openItem(data.page);
            } else {
              alert('新建页面失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求异常: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleCreateNewTable = function () {
        if (!newTableName.trim()) {
          alert('请输入新表名称');
          return;
        }
        setLoading(true);
        fetch('/api/dsh-notion/create-database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTableName.trim(),
            initialColumns: [
              { name: '标签', type: 'multi_select' },
              { name: '描述', type: 'rich_text' },
              { name: '数值', type: 'number' }
            ]
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setShowCreateTableModal(false);
              setNewTableName('');
              alert('新数据库表创建成功！');
              loadResources();
              openItem(data.database);
            } else {
              alert('创建新表失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求异常: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleAppendBlock = function () {
        if (!newContent.trim()) {
          alert('请输入要追加的内容');
          return;
        }
        if (!selectedItem) return;
        setLoading(true);
        fetch('/api/dsh-notion/append-block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: selectedItem.id,
            content: newContent,
            type: newBlockType
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setNewContent('');
              reloadCurrentItem();
            } else {
              alert('追加内容失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求出错: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleUpdateBlock = function (blockId, type) {
        if (!blockId) return;
        setLoading(true);
        fetch('/api/dsh-notion/update-block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blockId: blockId,
            content: editingBlockText,
            type: type
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setEditingBlockId(null);
              setEditingBlockText('');
              reloadCurrentItem();
            } else {
              alert('保存修改失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求出错: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleDeleteBlock = function (blockId) {
        if (!confirm('确定要删除此段落/块内容吗？')) return;
        setLoading(true);
        fetch('/api/dsh-notion/delete-block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockId: blockId })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              reloadCurrentItem();
            } else {
              alert('删除失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求出错: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleDeletePageOrRow = function (id, isRow) {
        var msg = isRow ? '确定要在数据库中删除/归档此行数据吗？' : '确定要删除/归档此页面吗？';
        if (!confirm(msg)) return;
        setLoading(true);
        fetch('/api/dsh-notion/delete-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: id })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              if (isRow) {
                reloadCurrentItem();
              } else {
                alert('页面已删除/归档！');
                setSelectedItem(null);
                setTab('resources');
                loadResources();
              }
            } else {
              alert('删除失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求出错: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleSaveTitle = function () {
        if (!pageTitleEdit.trim() || !selectedItem) return;
        setLoading(true);
        fetch('/api/dsh-notion/update-page-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: selectedItem.id,
            title: pageTitleEdit.trim()
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              setIsEditingTitle(false);
              reloadCurrentItem();
              loadResources();
            } else {
              alert('修改标题失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('请求出错: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      var handleCreatePage = function (isDb) {
        if (!newTitle.trim()) {
          alert('请输入标题');
          return;
        }
        setLoading(true);
        fetch('/api/dsh-notion/create-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle,
            content: newContent,
            parentId: selectedItem ? selectedItem.id : undefined,
            isDatabase: isDb
          })
        })
          .then(parseJsonResponse)
          .then(function (data) {
            if (data.success) {
              alert('创建成功！');
              setNewTitle('');
              setNewContent('');
              loadResources();
            } else {
              alert('创建失败: ' + data.error);
            }
          })
          .catch(function (err) { alert('网络请求错误: ' + err.message); })
          .finally(function () { setLoading(false); });
      };

      // Header 栏
      var headerElement = React.createElement('div', {
        key: 'header',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.1))',
          background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.5))',
          backdropFilter: 'blur(8px)'
        }
      }, [
        React.createElement('div', { key: 'brand', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
          React.createElement('span', {
            key: 'icon',
            dangerouslySetInnerHTML: { __html: NOTION_ICON },
            style: { display: 'flex', color: 'var(--dsw-alias-brand-primary, #526aa8)' }
          }),
          React.createElement('span', { key: 'title', style: { fontWeight: 600, fontSize: 16, color: 'var(--dsw-alias-label-primary, inherit)' } }, 'Notion 存储与知识库'),
          config.hasKey
            ? React.createElement('span', { key: 'status', style: { fontSize: 12, background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: 12 } }, '已连接')
            : React.createElement('span', { key: 'status', style: { fontSize: 12, background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: 12 } }, '未配置 Token')
        ]),
        React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8 } }, [
          React.createElement('button', {
            key: 'tab-res',
            style: {
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === 'resources' ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
              color: tab === 'resources' ? '#fff' : 'var(--dsw-alias-label-secondary, #666)'
            },
            onClick: function () { setTab('resources'); loadResources(); }
          }, '资源列表'),
          selectedItem ? React.createElement('button', {
            key: 'tab-item',
            style: {
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: (tab === 'table' || tab === 'page') ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
              color: (tab === 'table' || tab === 'page') ? '#fff' : 'var(--dsw-alias-label-secondary, #666)'
            },
            onClick: function () { setTab(selectedItem.object === 'database' ? 'table' : 'page'); }
          }, selectedItem.object === 'database' ? '📊 表格数据' : '📝 页面内容') : null,
          React.createElement('button', {
            key: 'tab-set',
            style: {
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === 'settings' ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
              color: tab === 'settings' ? '#fff' : 'var(--dsw-alias-label-secondary, #666)'
            },
            onClick: function () { setTab('settings'); }
          }, '⚙️ 连接配置'),
          React.createElement('button', {
            key: 'btn-close',
            style: {
              marginLeft: 12, padding: '6px 10px', borderRadius: 6,
              border: '1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.2))',
              background: 'transparent',
              color: 'var(--dsw-alias-label-secondary, #888)',
              cursor: 'pointer'
            },
            onClick: onClose
          }, '✕ 关闭')
        ])
      ]);

      // Body 视图
      var bodyElement = null;

      if (tab === 'resources') {
        var pagesList = [];
        var dbsList = [];

        resources.forEach(function (item) {
          if (item.object === 'database') dbsList.push(item);
          else pagesList.push(item);
        });

        var renderResourceItem = function (item) {
          var isDb = item.object === 'database';
          var title = '无标题';
          if (isDb && item.title && item.title[0] && item.title[0].plain_text) {
            title = item.title.map(function (part) { return part.plain_text || ''; }).join('') || title;
          } else if (item.properties && item.properties.title && item.properties.title.title) {
            title = item.properties.title.title.map(function (part) { return part.plain_text || ''; }).join('') || title;
          } else if (item.properties && item.properties.Name && item.properties.Name.title) {
            title = item.properties.Name.title.map(function (part) { return part.plain_text || ''; }).join('') || title;
          }

          return React.createElement('div', {
            key: item.id,
            onClick: function () { openItem(item); },
            style: {
              padding: '10px 14px',
              background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.7))',
              borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.25))',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            },
            onMouseEnter: function (e) { e.currentTarget.style.borderColor = 'var(--dsw-alias-brand-primary, #3b82f6)'; },
            onMouseLeave: function (e) { e.currentTarget.style.borderColor = 'var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.25))'; }
          }, [
            React.createElement('div', { key: 'l', style: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 } }, [
              React.createElement('span', { key: 'ic', style: { fontSize: 16 } }, isDb ? '📊' : '📄'),
              React.createElement('span', {
                key: 'tt',
                style: { fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dsw-alias-label-primary, inherit)' }
              }, title)
            ]),
            React.createElement('div', { key: 'r', style: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 } }, [
              React.createElement('span', {
                key: 'tm',
                style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary, #999)' }
              }, new Date(item.last_edited_time).toLocaleDateString()),
              React.createElement('span', {
                key: 'arr',
                style: { fontSize: 12, color: 'var(--dsw-alias-brand-primary, #3b82f6)' }
              }, '进入 →')
            ])
          ]);
        };

        bodyElement = React.createElement('div', { key: 'resources-view', style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
          // 单列垂直堆叠区域（整洁行式卡片）
          React.createElement('div', {
            key: 'single-col-container',
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }
          }, [
            // 分类一：文档页面 (Pages)
            React.createElement('div', {
              key: 'sec-pages',
              style: {
                background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.65))',
                borderRadius: 12, padding: 18,
                border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.25))',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }
            }, [
              React.createElement('div', {
                key: 'h-p',
                style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--dsw-alias-border-l1, #eee)' }
              }, [
                React.createElement('div', { key: 'l', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
                  React.createElement('span', { key: 'ic', style: { fontSize: 18 } }, '📝'),
                  React.createElement('span', { key: 'tx', style: { fontWeight: 600, fontSize: 16, color: 'var(--dsw-alias-label-primary, inherit)' } }, '文档页面 (Pages)'),
                  React.createElement('span', { key: 'cnt', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #999)' } }, '(' + pagesList.length + ')')
                ]),
                React.createElement('div', { key: 'r-acts', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
                  React.createElement('button', {
                    key: 'b-ref',
                    style: {
                      background: 'transparent',
                      border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                      color: 'var(--dsw-alias-label-secondary, #666)',
                      borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12
                    },
                    title: '刷新资源列表',
                    onClick: loadResources
                  }, loading ? '...' : '🔄 刷新'),
                  React.createElement('button', {
                    key: 'b-add',
                    style: {
                      background: 'var(--dsw-alias-brand-primary, #3b82f6)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500
                    },
                    onClick: function () { setShowCreatePageModal(true); }
                  }, '+ 新建页面')
                ])
              ]),
              React.createElement('div', { key: 'list-p', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                pagesList.length === 0 ? [
                  React.createElement('div', { key: 'em', style: { padding: '20px 0', textAlign: 'center', color: '#999', fontSize: 13 } }, '暂无独立文档页面，点击右上角「+ 新建页面」添加')
                ] : pagesList.map(renderResourceItem)
              )
            ]),

            // 分类二：数据表格 (Databases)
            React.createElement('div', {
              key: 'sec-dbs',
              style: {
                background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.65))',
                borderRadius: 12, padding: 18,
                border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.25))',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }
            }, [
              React.createElement('div', {
                key: 'h-d',
                style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--dsw-alias-border-l1, #eee)' }
              }, [
                React.createElement('div', { key: 'l', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
                  React.createElement('span', { key: 'ic', style: { fontSize: 18 } }, '📊'),
                  React.createElement('span', { key: 'tx', style: { fontWeight: 600, fontSize: 16, color: 'var(--dsw-alias-label-primary, inherit)' } }, '数据库表 (Databases)'),
                  React.createElement('span', { key: 'cnt', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #999)' } }, '(' + dbsList.length + ')')
                ]),
                React.createElement('div', { key: 'r-acts', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
                  React.createElement('button', {
                    key: 'b-ref',
                    style: {
                      background: 'transparent',
                      border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                      color: 'var(--dsw-alias-label-secondary, #666)',
                      borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12
                    },
                    title: '刷新资源列表',
                    onClick: loadResources
                  }, loading ? '...' : '🔄 刷新'),
                  React.createElement('button', {
                    key: 'b-add',
                    style: {
                      background: 'var(--dsw-alias-brand-primary, #3b82f6)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500
                    },
                    onClick: function () { setShowCreateTableModal(true); }
                  }, '+ 新建数据表')
                ])
              ]),
              React.createElement('div', { key: 'list-d', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                dbsList.length === 0 ? [
                  React.createElement('div', { key: 'em', style: { padding: '20px 0', textAlign: 'center', color: '#999', fontSize: 13 } }, '暂无数据库表格，点击右上角「+ 新建数据表」添加')
                ] : dbsList.map(renderResourceItem)
              )
            ])
          ]),

          // 新建页面弹窗
          showCreatePageModal ? React.createElement('div', {
            key: 'modal-create-page',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, backdropFilter: 'blur(3px)'
            }
          }, [
            React.createElement('div', {
              key: 'card',
              style: {
                width: 420, background: 'var(--dsw-alias-bg-layer-1, #fff)', padding: 24, borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.2)', border: '1px solid var(--dsw-alias-border-l1, #ddd)'
              }
            }, [
              React.createElement('h3', { key: 'h', style: { margin: '0 0 12px', color: 'var(--dsw-alias-label-primary, inherit)' } }, '📝 新建 Notion 文档页面'),
              React.createElement('div', { key: 'f1', style: { marginBottom: 12 } }, [
                React.createElement('label', { key: 'l1', style: { display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 } }, '页面标题:'),
                React.createElement('input', {
                  key: 'inp1',
                  type: 'text',
                  placeholder: '例如：系统部署方案、会议纪要、调研报告',
                  style: { width: '100%', padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newPageName,
                  onChange: function (e) { setNewPageName(e.target.value); }
                })
              ]),
              React.createElement('div', { key: 'f2', style: { marginBottom: 20 } }, [
                React.createElement('label', { key: 'l2', style: { display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 } }, '初始正文 (可选):'),
                React.createElement('textarea', {
                  key: 'inp2',
                  placeholder: '输入初始内容或留空...',
                  style: { width: '100%', height: 70, padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newPageDesc,
                  onChange: function (e) { setNewPageDesc(e.target.value); }
                })
              ]),
              React.createElement('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 10 } }, [
                React.createElement('button', {
                  key: 'b-cancel',
                  style: { padding: '7px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
                  onClick: function () { setShowCreatePageModal(false); }
                }, '取消'),
                React.createElement('button', {
                  key: 'b-ok',
                  style: { padding: '7px 16px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
                  onClick: handleCreateNewPage
                }, loading ? '创建中...' : '立即创建')
              ])
            ])
          ]) : null,

          // 新建数据库表弹窗 (Modal)
          showCreateTableModal ? React.createElement('div', {
            key: 'modal-create-table',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, backdropFilter: 'blur(3px)'
            }
          }, [
            React.createElement('div', {
              key: 'card',
              style: {
                width: 420, background: 'var(--dsw-alias-bg-layer-1, #fff)', padding: 24, borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.2)', border: '1px solid var(--dsw-alias-border-l1, #ddd)'
              }
            }, [
              React.createElement('h3', { key: 'h', style: { margin: '0 0 12px', color: 'var(--dsw-alias-label-primary, inherit)' } }, '📊 新建 Notion 数据表 (Database)'),
              React.createElement('p', { key: 'p', style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary, #666)', margin: '0 0 16px' } },
                '将在你的 DSH 页面下创建一张全新的独立数据表，自动初始化「名称、标签、描述、数值」列，创建后可自由增删列。'
              ),
              React.createElement('div', { key: 'f', style: { marginBottom: 20 } }, [
                React.createElement('label', { key: 'l', style: { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 } }, '新数据表名称:'),
                React.createElement('input', {
                  key: 'inp',
                  type: 'text',
                  placeholder: '例如：项目缺陷跟踪表、服务器资产表、API凭据库',
                  style: { width: '100%', padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newTableName,
                  onChange: function (e) { setNewTableName(e.target.value); }
                })
              ]),
              React.createElement('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 10 } }, [
                React.createElement('button', {
                  key: 'b-cancel',
                  style: { padding: '7px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
                  onClick: function () { setShowCreateTableModal(false); }
                }, '取消'),
                React.createElement('button', {
                  key: 'b-ok',
                  style: { padding: '7px 16px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
                  onClick: handleCreateNewTable
                }, loading ? '创建中...' : '立即创建')
              ])
            ])
          ]) : null
        ]);
      } else if (tab === 'table') {
        var dbTitle = '无标题数据表';
        if (selectedItem && selectedItem.title && selectedItem.title[0]) {
          dbTitle = selectedItem.title[0].plain_text;
        }

        // 提取所有列字段（包含类型）
        var columns = [];
        if (databaseSchema) {
          for (var pKey in databaseSchema) {
            columns.push({ name: pKey, meta: databaseSchema[pKey] });
          }
        } else if (databaseRows.length > 0 && databaseRows[0].properties) {
          for (var rKey in databaseRows[0].properties) {
            columns.push({ name: rKey, meta: databaseRows[0].properties[rKey] });
          }
        }
        // 保证 title 列排在首位
        columns.sort(function (a, b) {
          if (a.meta && a.meta.type === 'title') return -1;
          if (b.meta && b.meta.type === 'title') return 1;
          return 0;
        });

        // 过滤行（查）
        var filteredRows = databaseRows.filter(function (row) {
          if (!tableFilterText.trim()) return true;
          var q = tableFilterText.toLowerCase();
          for (var c = 0; c < columns.length; c++) {
            var colDef = columns[c];
            var prop = row.properties && row.properties[colDef.name];
            var valStr = '';
            if (prop) {
              if (prop.title) valStr = prop.title.map(function (t) { return t.plain_text; }).join('');
              else if (prop.rich_text) valStr = prop.rich_text.map(function (t) { return t.plain_text; }).join('');
              else if (prop.number !== undefined) valStr = String(prop.number);
              else if (prop.select && prop.select.name) valStr = prop.select.name;
              else if (prop.multi_select) valStr = prop.multi_select.map(function (m) { return m.name; }).join(' ');
              else if (prop.url) valStr = prop.url;
            }
            if (valStr.toLowerCase().indexOf(q) !== -1) return true;
          }
          return false;
        });

        var renderCellValue = function (row, col) {
          var prop = row.properties && row.properties[col.name];
          if (!prop) return '-';
          if (prop.type === 'title' && prop.title) {
            return (prop.title[0] && prop.title[0].plain_text) || '无标题';
          }
          if (prop.type === 'rich_text' && prop.rich_text) {
            return prop.rich_text.map(function (t) { return t.plain_text; }).join('') || '-';
          }
          if (prop.type === 'number') {
            return prop.number !== null && prop.number !== undefined ? String(prop.number) : '-';
          }
          if (prop.type === 'select' && prop.select) {
            return React.createElement('span', {
              style: { padding: '2px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', fontSize: 12 }
            }, prop.select.name);
          }
          if (prop.type === 'multi_select' && prop.multi_select) {
            return React.createElement('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } }, prop.multi_select.map(function (m, idx) {
              return React.createElement('span', {
                key: idx,
                style: { padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: 11 }
              }, m.name);
            }));
          }
          if (prop.type === 'checkbox') {
            return prop.checkbox ? '✅ 是' : '⬜ 否';
          }
          if (prop.type === 'url') {
            return prop.url ? React.createElement('a', { href: prop.url, target: '_blank', style: { color: '#3b82f6' } }, prop.url) : '-';
          }
          if (prop.type === 'date' && prop.date) {
            return prop.date.start || '-';
          }
          return '-';
        };

        bodyElement = React.createElement('div', { key: 'table-view', style: { display: 'flex', flexDirection: 'column', gap: 14 } }, [
          // 顶部操作栏
          React.createElement('div', {
            key: 'bar',
            style: {
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px', borderRadius: 10,
              background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.7))',
              border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.3))'
            }
          }, [
            React.createElement('div', { key: 'tbl-meta', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
              React.createElement('span', { key: 'icon', style: { fontSize: 20 } }, '📊'),
              React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: 17, color: 'var(--dsw-alias-label-primary, inherit)' } }, dbTitle),
              React.createElement('span', { key: 'count', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)' } }, '(共 ' + databaseRows.length + ' 行，已配置 ' + columns.length + ' 个列字段)')
            ]),
            React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, alignItems: 'center' } }, [
              React.createElement('input', {
                key: 'search-input',
                type: 'text',
                placeholder: '🔍 检索表格内容...',
                style: {
                  padding: '6px 10px', fontSize: 13, borderRadius: 6,
                  border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                  background: 'var(--dsw-alias-bg-base, #fff)',
                  color: 'var(--dsw-alias-label-primary, inherit)', outline: 'none'
                },
                value: tableFilterText,
                onChange: function (e) { setTableFilterText(e.target.value); }
              }),
              React.createElement('button', {
                key: 'btn-add-col',
                style: { padding: '6px 12px', background: 'var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.7))', border: '1px solid var(--dsw-alias-border-l2, #ccc)', color: 'var(--dsw-alias-label-primary, inherit)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
                onClick: function () { setShowAddColModal(true); }
              }, '+ 扩展新列'),
              React.createElement('button', {
                key: 'btn-add-row',
                style: { padding: '6px 14px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
                onClick: function () {
                  var initialVals = {};
                  columns.forEach(function (col) { initialVals[col.name] = ''; });
                  setEditingRowValues(initialVals);
                  setEditingRowId('new');
                }
              }, '+ 新增数据行'),
              React.createElement('button', {
                key: 'btn-reload',
                style: { padding: '6px 10px', background: 'transparent', border: '1px solid var(--dsw-alias-border-l2, #ccc)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
                onClick: reloadCurrentItem
              }, '🔄')
            ])
          ]),

          // 表格展示区
          React.createElement('div', {
            key: 'tbl-box',
            style: {
              overflowX: 'auto', border: '1px solid var(--dsw-alias-border-l1, #ddd)',
              borderRadius: 10, background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.65))',
              boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
            }
          }, [
            React.createElement('table', { key: 'tbl', style: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 } }, [
              React.createElement('thead', { key: 'thd' }, [
                React.createElement('tr', { key: 'trh', style: { background: 'var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.85))', borderBottom: '1px solid var(--dsw-alias-border-l2, #ddd)' } }, [
                  React.createElement('th', { key: 'th-id', style: { padding: '10px 14px', color: 'var(--dsw-alias-label-secondary, #666)', width: 60 } }, '#'),
                  columns.map(function (col) {
                    var typeLabel = col.meta ? col.meta.type : 'text';
                    return React.createElement('th', {
                      key: 'th-' + col.name,
                      style: { padding: '10px 14px', color: 'var(--dsw-alias-label-primary, inherit)', whiteSpace: 'nowrap' }
                    }, [
                      col.name,
                      React.createElement('span', { key: 't', style: { fontSize: 10, marginLeft: 6, color: 'var(--dsw-alias-label-tertiary, #999)', fontWeight: 400 } }, '(' + typeLabel + ')')
                    ]);
                  }),
                  React.createElement('th', { key: 'th-time', style: { padding: '10px 14px', color: 'var(--dsw-alias-label-secondary, #666)', width: 140 } }, '创建时间'),
                  React.createElement('th', { key: 'th-act', style: { padding: '10px 14px', color: 'var(--dsw-alias-label-secondary, #666)', textAlign: 'right', width: 130 } }, '操作')
                ])
              ]),
              React.createElement('tbody', { key: 'tbd' }, filteredRows.length === 0 ? [
                React.createElement('tr', { key: 'empty-tr' }, [
                  React.createElement('td', {
                    colSpan: columns.length + 3,
                    style: { padding: '36px 0', textAlign: 'center', color: 'var(--dsw-alias-label-tertiary, #999)' }
                  }, tableFilterText ? '未找到匹配该关键字的行记录。' : '当前数据表尚无数据行，点击右上角「+ 新增数据行」添加。')
                ])
              ] : filteredRows.map(function (row, idx) {
                return React.createElement('tr', {
                  key: row.id,
                  style: { borderBottom: '1px solid var(--dsw-alias-border-l1, #eee)', background: idx % 2 === 0 ? 'transparent' : 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.015))' }
                }, [
                  React.createElement('td', { key: 'td-id', style: { padding: '10px 14px', color: 'var(--dsw-alias-label-caption, #888)' } }, idx + 1),
                  columns.map(function (col) {
                    return React.createElement('td', {
                      key: 'td-' + col.name,
                      style: { padding: '10px 14px', color: 'var(--dsw-alias-label-primary, inherit)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }
                    }, renderCellValue(row, col));
                  }),
                  React.createElement('td', { key: 'td-time', style: { padding: '10px 14px', color: 'var(--dsw-alias-label-secondary, #666)', fontSize: 12 } }, new Date(row.created_time).toLocaleString()),
                  React.createElement('td', { key: 'td-act', style: { padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' } }, [
                    React.createElement('button', {
                      key: 'btn-edit-row',
                      style: { background: 'none', border: 'none', color: 'var(--dsw-alias-brand-primary, #3b82f6)', cursor: 'pointer', marginRight: 8, fontSize: 12 },
                      onClick: function () {
                        var curVals = {};
                        columns.forEach(function (col) {
                          var p = row.properties && row.properties[col.name];
                          if (!p) curVals[col.name] = '';
                          else if (p.type === 'title') curVals[col.name] = (p.title && p.title[0] && p.title[0].plain_text) || '';
                          else if (p.type === 'rich_text') curVals[col.name] = (p.rich_text && p.rich_text.map(function (t) { return t.plain_text; }).join('')) || '';
                          else if (p.type === 'number') curVals[col.name] = p.number !== null ? String(p.number) : '';
                          else if (p.type === 'select') curVals[col.name] = (p.select && p.select.name) || '';
                          else if (p.type === 'multi_select') curVals[col.name] = (p.multi_select && p.multi_select.map(function (m) { return m.name; }).join(',')) || '';
                          else if (p.type === 'checkbox') curVals[col.name] = Boolean(p.checkbox);
                          else if (p.type === 'url') curVals[col.name] = p.url || '';
                        });
                        setEditingRowValues(curVals);
                        setEditingRowId(row.id);
                      }
                    }, '编辑'),
                    React.createElement('a', {
                      key: 'link',
                      href: row.url,
                      target: '_blank',
                      style: { color: 'var(--dsw-alias-label-secondary, #666)', textDecoration: 'none', marginRight: 8, fontSize: 12 }
                    }, 'Notion ↗'),
                    React.createElement('button', {
                      key: 'del-row',
                      style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 },
                      onClick: function () { handleDeletePageOrRow(row.id, true); }
                    }, '删除')
                  ])
                ]);
              }))
            ])
          ]),

          // 行记录新增/编辑模态弹窗 (Modal)
          editingRowId ? React.createElement('div', {
            key: 'modal-row-edit',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, backdropFilter: 'blur(3px)'
            }
          }, [
            React.createElement('div', {
              key: 'card',
              style: {
                width: 480, maxHeight: '85vh', overflowY: 'auto',
                background: 'var(--dsw-alias-bg-layer-1, #fff)', padding: 24, borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.2)', border: '1px solid var(--dsw-alias-border-l1, #ddd)'
              }
            }, [
              React.createElement('h3', { key: 'm-title', style: { margin: '0 0 16px', color: 'var(--dsw-alias-label-primary, inherit)' } },
                editingRowId === 'new' ? '✨ 新增数据行记录' : '✏️ 编辑数据行记录'
              ),
              React.createElement('div', { key: 'm-form', style: { display: 'flex', flexDirection: 'column', gap: 12 } }, columns.map(function (col) {
                var pType = col.meta ? col.meta.type : 'rich_text';
                return React.createElement('div', { key: 'f-' + col.name }, [
                  React.createElement('label', {
                    key: 'lbl',
                    style: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--dsw-alias-label-primary, inherit)' }
                  }, [
                    col.name,
                    React.createElement('span', { key: 'tp', style: { fontSize: 11, color: '#888', marginLeft: 6 } }, '(' + pType + ')')
                  ]),
                  pType === 'checkbox' ? React.createElement('input', {
                    key: 'inp-chk',
                    type: 'checkbox',
                    checked: Boolean(editingRowValues[col.name]),
                    onChange: function (e) {
                      var n = Object.assign({}, editingRowValues);
                      n[col.name] = e.target.checked;
                      setEditingRowValues(n);
                    }
                  }) : React.createElement('input', {
                    key: 'inp-txt',
                    type: pType === 'number' ? 'number' : 'text',
                    style: {
                      width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                      borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                      background: 'var(--dsw-alias-bg-base, #fff)', color: 'var(--dsw-alias-label-primary, inherit)', fontSize: 13
                    },
                    placeholder: pType === 'multi_select' ? '多个标签用逗号分隔，如：核心, 常用' : '输入 ' + col.name + ' 内容...',
                    value: editingRowValues[col.name] !== undefined ? editingRowValues[col.name] : '',
                    onChange: function (e) {
                      var n = Object.assign({}, editingRowValues);
                      n[col.name] = e.target.value;
                      setEditingRowValues(n);
                    }
                  })
                ]);
              })),
              React.createElement('div', { key: 'm-actions', style: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 } }, [
                React.createElement('button', {
                  key: 'b-cancel',
                  style: { padding: '7px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
                  onClick: function () { setEditingRowId(null); }
                }, '取消'),
                React.createElement('button', {
                  key: 'b-save',
                  style: { padding: '7px 16px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
                  onClick: handleSaveRow
                }, loading ? '保存中...' : '确定保存')
              ])
            ])
          ]) : null,

          // 扩展列弹窗 (Modal)
          showAddColModal ? React.createElement('div', {
            key: 'modal-add-col',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, backdropFilter: 'blur(3px)'
            }
          }, [
            React.createElement('div', {
              key: 'card',
              style: {
                width: 400, background: 'var(--dsw-alias-bg-layer-1, #fff)', padding: 24, borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.2)', border: '1px solid var(--dsw-alias-border-l1, #ddd)'
              }
            }, [
              React.createElement('h3', { key: 'h', style: { margin: '0 0 16px', color: 'var(--dsw-alias-label-primary, inherit)' } }, '➕ 为当前表添加新列字段'),
              React.createElement('div', { key: 'f1', style: { marginBottom: 12 } }, [
                React.createElement('label', { key: 'lbl1', style: { display: 'block', fontSize: 13, marginBottom: 4 } }, '列名称:'),
                React.createElement('input', {
                  key: 'inp-name',
                  type: 'text',
                  placeholder: '例如：优先级、备注、截止日期、评分',
                  style: { width: '100%', padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newColName,
                  onChange: function (e) { setNewColName(e.target.value); }
                })
              ]),
              React.createElement('div', { key: 'f2', style: { marginBottom: 20 } }, [
                React.createElement('label', { key: 'lbl2', style: { display: 'block', fontSize: 13, marginBottom: 4 } }, '字段类型:'),
                React.createElement('select', {
                  key: 'sel-type',
                  style: { width: '100%', padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newColType,
                  onChange: function (e) { setNewColType(e.target.value); }
                }, [
                  React.createElement('option', { key: 'o1', value: 'rich_text' }, '文本 (Text / Rich Text)'),
                  React.createElement('option', { key: 'o2', value: 'number' }, '数字 (Number)'),
                  React.createElement('option', { key: 'o3', value: 'select' }, '单选标签 (Select)'),
                  React.createElement('option', { key: 'o4', value: 'multi_select' }, '多选标签 (Multi-Select)'),
                  React.createElement('option', { key: 'o5', value: 'checkbox' }, '复选框 (Checkbox)'),
                  React.createElement('option', { key: 'o6', value: 'date' }, '日期 (Date)'),
                  React.createElement('option', { key: 'o7', value: 'url' }, '网址链接 (URL)')
                ])
              ]),
              React.createElement('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 10 } }, [
                React.createElement('button', {
                  key: 'b-cancel',
                  style: { padding: '7px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
                  onClick: function () { setShowAddColModal(false); }
                }, '取消'),
                React.createElement('button', {
                  key: 'b-ok',
                  style: { padding: '7px 16px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' },
                  onClick: handleAddColumn
                }, loading ? '扩展中...' : '确认添加')
              ])
            ])
          ]) : null,

          // 新建数据库表弹窗 (Modal)
          showCreateTableModal ? React.createElement('div', {
            key: 'modal-create-table',
            style: {
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 9999, backdropFilter: 'blur(3px)'
            }
          }, [
            React.createElement('div', {
              key: 'card',
              style: {
                width: 420, background: 'var(--dsw-alias-bg-layer-1, #fff)', padding: 24, borderRadius: 12,
                boxShadow: '0 12px 36px rgba(0,0,0,0.2)', border: '1px solid var(--dsw-alias-border-l1, #ddd)'
              }
            }, [
              React.createElement('h3', { key: 'h', style: { margin: '0 0 12px', color: 'var(--dsw-alias-label-primary, inherit)' } }, '📊 新建 Notion 数据表 (Database)'),
              React.createElement('p', { key: 'p', style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary, #666)', margin: '0 0 16px' } },
                '将在你的授权父页面下创建一张全新的独立数据表，自动初始化「名称、标签、描述、数值」列，创建后可自由增删列。'
              ),
              React.createElement('div', { key: 'f', style: { marginBottom: 20 } }, [
                React.createElement('label', { key: 'l', style: { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500 } }, '新数据表名称:'),
                React.createElement('input', {
                  key: 'inp',
                  type: 'text',
                  placeholder: '例如：项目缺陷跟踪表、服务器资产表、API凭据库',
                  style: { width: '100%', padding: '8px 12px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid #ccc', fontSize: 13 },
                  value: newTableName,
                  onChange: function (e) { setNewTableName(e.target.value); }
                })
              ]),
              React.createElement('div', { key: 'acts', style: { display: 'flex', justifyContent: 'flex-end', gap: 10 } }, [
                React.createElement('button', {
                  key: 'b-cancel',
                  style: { padding: '7px 14px', background: 'transparent', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' },
                  onClick: function () { setShowCreateTableModal(false); }
                }, '取消'),
                React.createElement('button', {
                  key: 'b-ok',
                  style: { padding: '7px 16px', background: 'var(--dsw-alias-brand-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 },
                  onClick: handleCreateNewTable
                }, loading ? '创建中...' : '立即创建')
              ])
            ])
          ]) : null
        ]);
      } else if (tab === 'page') {
        var statusColor = '#16a34a';
        var statusText = '已同步至 Notion 云端';
        if (autoSaveStatus === 'dirty') {
          statusColor = '#d97706';
          statusText = '已修改 (500ms 存本地缓存)';
        } else if (autoSaveStatus === 'saving') {
          statusColor = '#2563eb';
          statusText = '正在写入本地缓存...';
        } else if (autoSaveStatus === 'cached') {
          statusColor = '#059669';
          statusText = '💾 已保存至本地缓存 (后台同步中)';
        } else if (autoSaveStatus === 'synced') {
          statusColor = '#16a34a';
          statusText = '☁️ 已全量同步至 Notion 云端';
        } else if (autoSaveStatus === 'error') {
          statusColor = '#dc2626';
          statusText = '同步异常 (本地缓存已留存)';
        }

        bodyElement = React.createElement('div', {
          key: 'page-view',
          style: { display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }
        }, [
          // 顶部页面工具条与保存指示
          React.createElement('div', {
            key: 'page-bar',
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderRadius: 10,
              background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.7))',
              border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.3))'
            }
          }, [
            React.createElement('div', { key: 'title-col', style: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 } }, [
              React.createElement('span', { key: 'doc-icon', style: { fontSize: 20 } }, '📄'),
              React.createElement('input', {
                key: 'page-title-input',
                type: 'text',
                placeholder: '输入文档标题...',
                style: {
                  fontSize: 18, fontWeight: 700, border: 'none', background: 'transparent',
                  color: 'var(--dsw-alias-label-primary, inherit)', outline: 'none', width: '70%',
                  borderBottom: '1px dashed var(--dsw-alias-border-l2, #ccc)', padding: '2px 4px'
                },
                value: pageTitleEdit,
                onChange: function (e) {
                  var v = e.target.value;
                  setPageTitleEdit(v);
                  triggerAutoSave(pageMarkdown, v);
                }
              })
            ]),
            React.createElement('div', { key: 'status-col', style: { display: 'flex', alignItems: 'center', gap: 12 } }, [
              React.createElement('div', {
                key: 'autosave-indicator',
                style: {
                  fontSize: 12, padding: '3px 10px', borderRadius: 12,
                  background: statusColor + '18', color: statusColor,
                  border: '1px solid ' + statusColor + '40',
                  display: 'flex', alignItems: 'center', gap: 6
                }
              }, [
                React.createElement('span', {
                  key: 'dot',
                  style: { width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block' }
                }),
                statusText
              ]),
              React.createElement('div', { key: 'view-mode-switch', style: { display: 'flex', background: 'var(--dsw-alias-bg-layer-2, #eee)', borderRadius: 6, padding: 2 } }, [
                React.createElement('button', {
                  key: 'btn-split',
                  style: {
                    padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                    background: viewMode === 'edit' ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
                    color: viewMode === 'edit' ? '#fff' : 'var(--dsw-alias-label-secondary, #666)'
                  },
                  onClick: function () { setViewMode('edit'); }
                }, '双栏即编即看'),
                React.createElement('button', {
                  key: 'btn-prev',
                  style: {
                    padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                    background: viewMode === 'preview' ? 'var(--dsw-alias-brand-primary, #3b82f6)' : 'transparent',
                    color: viewMode === 'preview' ? '#fff' : 'var(--dsw-alias-label-secondary, #666)'
                  },
                  onClick: function () { setViewMode('preview'); }
                }, '仅看渲染排版')
              ]),
              selectedItem && selectedItem.url ? React.createElement('a', {
                key: 'btn-ext',
                href: selectedItem.url,
                target: '_blank',
                style: { padding: '5px 10px', fontSize: 12, textDecoration: 'none', color: 'var(--dsw-alias-brand-primary, #3b82f6)' }
              }, 'Notion 原文 ↗') : null,
              React.createElement('button', {
                key: 'btn-del-doc',
                style: { padding: '5px 10px', fontSize: 12, color: '#dc2626', background: 'transparent', border: '1px solid #f87171', borderRadius: 6, cursor: 'pointer' },
                onClick: function () { handleDeletePageOrRow(selectedItem.id, false); }
              }, '删除')
            ])
          ]),

          // Notion 风格快捷工具条
          React.createElement('div', {
            key: 'notion-toolbar',
            style: {
              display: 'flex', gap: 6, padding: '6px 12px', borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.5))',
              border: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06))',
              alignItems: 'center', flexWrap: 'wrap'
            }
          }, [
            React.createElement('span', { key: 'hint', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #999)', marginRight: 6 } }, '快速插入:'),
            [
              { label: 'H1 大标题', snippet: '# ' },
              { label: 'H2 二级标题', snippet: '## ' },
              { label: 'H3 三级标题', snippet: '### ' },
              { label: '• 无序列表', snippet: '- ' },
              { label: '1. 有序列表', snippet: '1. ' },
              { label: '☑ 代办待办', snippet: '- [ ] ' },
              { label: '” 引用段落', snippet: '> ' },
              { label: '<> 代码块', snippet: '```javascript\n// 代码内容\n```\n' }
            ].map(function (btn, bIdx) {
              return React.createElement('button', {
                key: 'tb-' + bIdx,
                style: {
                  padding: '3px 9px', fontSize: 12, borderRadius: 5,
                  background: 'var(--dsw-alias-bg-base, #fff)',
                  border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                  color: 'var(--dsw-alias-label-primary, inherit)',
                  cursor: 'pointer'
                },
                onClick: function () {
                  var textarea = document.getElementById('notion-page-editor-area');
                  var newText = '';
                  if (textarea) {
                    var start = textarea.selectionStart;
                    var end = textarea.selectionEnd;
                    newText = pageMarkdown.substring(0, start) + btn.snippet + pageMarkdown.substring(end);
                    setPageMarkdown(newText);
                    triggerAutoSave(newText, pageTitleEdit);
                    setTimeout(function () {
                      textarea.focus();
                      textarea.setSelectionRange(start + btn.snippet.length, start + btn.snippet.length);
                    }, 50);
                  } else {
                    newText = pageMarkdown + (pageMarkdown ? '\n\n' : '') + btn.snippet;
                    setPageMarkdown(newText);
                    triggerAutoSave(newText, pageTitleEdit);
                  }
                }
              }, btn.label);
            }),
            React.createElement('span', { key: 'tip-undo', style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #999)', marginLeft: 'auto' } }, '支持 Ctrl+S 立即保存 / Ctrl+Z 撤回')
          ]),

          // 主编辑/渲染工作区
          React.createElement('div', {
            key: 'editor-workspace',
            style: {
              flex: 1, display: 'grid',
              gridTemplateColumns: viewMode === 'edit' ? '1fr 1fr' : '1fr',
              gap: 16, minHeight: 460
            }
          }, [
            // 左侧：实时 Markdown 编辑区（完全适配 Ctrl+S 立即保存与 Ctrl+Z 撤回）
            viewMode === 'edit' ? React.createElement('div', {
              key: 'left-editor-pane',
              style: { display: 'flex', flexDirection: 'column', height: '100%' }
            }, [
              React.createElement('textarea', {
                key: 'editor-textarea',
                id: 'notion-page-editor-area',
                style: {
                  flex: 1, width: '100%', boxSizing: 'border-box',
                  padding: 16, fontSize: 14, lineHeight: 1.65,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  background: 'var(--dsw-alias-bg-base, #fff)',
                  color: 'var(--dsw-alias-label-primary, inherit)',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.35))',
                  borderRadius: 10, outline: 'none', resize: 'none',
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.03)'
                },
                placeholder: '在此以 Markdown 格式书写或编辑内容（按 Ctrl+S 立即全量同步到云端，修改 500ms 即时留存本地缓存防丢，支持 Ctrl+Z 撤回）...',
                value: pageMarkdown,
                onKeyDown: function (e) {
                  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                    e.preventDefault();
                    performSaveNow(pageMarkdown, pageTitleEdit, true);
                  }
                },
                onChange: function (e) {
                  var val = e.target.value;
                  setPageMarkdown(val);
                  triggerAutoSave(val, pageTitleEdit);
                }
              })
            ]) : null,

            // 右侧：Notion 风格视觉渲染区
            React.createElement('div', {
              key: 'right-preview-pane',
              style: {
                padding: 24, borderRadius: 10,
                background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.75))',
                border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.3))',
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
              }
            }, [
              React.createElement('h1', {
                key: 'rend-h1',
                style: { fontSize: 24, fontWeight: 700, margin: '0 0 16px', borderBottom: '1px solid var(--dsw-alias-border-l1, #eee)', paddingBottom: 10 }
              }, pageTitleEdit || '无标题'),

              !pageMarkdown.trim() ? React.createElement('div', {
                key: 'rend-empty',
                style: { color: 'var(--dsw-alias-label-tertiary, #999)', fontSize: 13, paddingTop: 30, textAlign: 'center' }
              }, '页面内容为空。在左侧输入 Markdown 或使用工具条快速插入内容。') : null,

              (function () {
                var lines = pageMarkdown.split('\n');
                var elements = [];
                var inCode = false;
                var codeLines = [];

                for (var idx = 0; idx < lines.length; idx++) {
                  var line = lines[idx];

                  if (line.trim().startsWith('```')) {
                    if (!inCode) {
                      inCode = true;
                      codeLines = [];
                    } else {
                      inCode = false;
                      elements.push(React.createElement('pre', {
                        key: 'code-' + idx,
                        style: {
                          background: 'var(--dsw-alias-bg-layer-2, #f4f4f5)',
                          padding: 12, borderRadius: 8, overflowX: 'auto',
                          fontSize: 13, border: '1px solid var(--dsw-alias-border-l2, #e4e4e7)',
                          margin: '10px 0', fontFamily: 'Consolas, Monaco, monospace'
                        }
                      }, codeLines.join('\n')));
                      codeLines = [];
                    }
                    continue;
                  }

                  if (inCode) {
                    codeLines.push(line);
                    continue;
                  }

                  if (!line.trim()) {
                    elements.push(React.createElement('div', { key: 'sp-' + idx, style: { height: 10 } }));
                    continue;
                  }

                  if (line.startsWith('# ')) {
                    elements.push(React.createElement('h1', { key: 'l-' + idx, style: { fontSize: 20, fontWeight: 700, margin: '16px 0 6px' } }, line.slice(2)));
                  } else if (line.startsWith('## ')) {
                    elements.push(React.createElement('h2', { key: 'l-' + idx, style: { fontSize: 17, fontWeight: 600, margin: '14px 0 6px' } }, line.slice(3)));
                  } else if (line.startsWith('### ')) {
                    elements.push(React.createElement('h3', { key: 'l-' + idx, style: { fontSize: 15, fontWeight: 600, margin: '10px 0 4px' } }, line.slice(4)));
                  } else if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
                    var chk = line.startsWith('- [x] ') || line.startsWith('- [X] ');
                    elements.push(React.createElement('div', {
                      key: 'l-' + idx,
                      style: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', fontSize: 14 }
                    }, [
                      React.createElement('input', { key: 'chk', type: 'checkbox', checked: chk, readOnly: true }),
                      React.createElement('span', { key: 'txt', style: { textDecoration: chk ? 'line-through' : 'none', color: chk ? 'var(--dsw-alias-label-tertiary, #888)' : 'inherit' } }, line.slice(6))
                    ]));
                  } else if (line.startsWith('- ') || line.startsWith('* ')) {
                    elements.push(React.createElement('li', { key: 'l-' + idx, style: { margin: '4px 0 4px 18px', fontSize: 14 } }, line.slice(2)));
                  } else if (/^\d+\.\s/.test(line)) {
                    elements.push(React.createElement('li', { key: 'l-' + idx, style: { margin: '4px 0 4px 18px', fontSize: 14 } }, line.replace(/^\d+\.\s/, '')));
                  } else if (line.startsWith('> ')) {
                    elements.push(React.createElement('blockquote', {
                      key: 'l-' + idx,
                      style: {
                        margin: '10px 0', padding: '6px 14px', borderLeft: '3px solid var(--dsw-alias-brand-primary, #3b82f6)',
                        background: 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.02))', borderRadius: '0 6px 6px 0',
                        color: 'var(--dsw-alias-label-secondary, #666)', fontStyle: 'italic'
                      }
                    }, line.slice(2)));
                  } else {
                    elements.push(React.createElement('p', { key: 'l-' + idx, style: { margin: '6px 0', lineHeight: 1.7, fontSize: 14 } }, line));
                  }
                }
                if (inCode && codeLines.length > 0) {
                  elements.push(React.createElement('pre', {
                    key: 'code-last',
                    style: { background: 'var(--dsw-alias-bg-layer-2, #f4f4f5)', padding: 12, borderRadius: 8, overflowX: 'auto', fontSize: 13 }
                  }, codeLines.join('\n')));
                }
                return elements;
              })()
            ])
          ])
        ]);
      } else if (tab === 'settings') {
        bodyElement = React.createElement('div', {
          key: 'settings-view',
          style: {
            maxWidth: 680,
            background: 'var(--dsw-alias-bg-layer-1, rgba(255,255,255,0.7))',
            padding: 28,
            borderRadius: 14,
            border: '1px solid var(--dsw-alias-border-l1, rgba(197, 164, 104, 0.3))',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
          }
        }, [
          React.createElement('h3', { key: 'st', style: { marginTop: 0, fontSize: 18, color: 'var(--dsw-alias-label-primary, inherit)' } }, 'Notion 存储连接配置'),
          React.createElement('p', { key: 'sd', style: { color: 'var(--dsw-alias-label-secondary, #666)', fontSize: 13, lineHeight: 1.6 } },
            '在 Notion 开发者平台 (notion.so/my-integrations) 创建「Internal Integration」获取 Token，并在你的 Notion 页面/表格右上角点击「...」->「Add connections」授权连接。直接在下方输入两项信息即可即时测试，无需先点击保存。'
          ),
          React.createElement('div', { key: 'form', style: { display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 } }, [
            React.createElement('div', { key: 'f1' }, [
              React.createElement('label', { key: 'l1', style: { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500, color: 'var(--dsw-alias-label-primary, inherit)' } }, 'Notion API Key (Secret):'),
              React.createElement('input', {
                key: 'i1',
                type: 'password',
                style: {
                  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                  background: 'var(--dsw-alias-bg-base, #fff)',
                  border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                  color: 'var(--dsw-alias-label-primary, #000)',
                  borderRadius: 8, outline: 'none', fontSize: 14
                },
                placeholder: config.hasKey ? '当前已配置密钥（如需更改请输入新 Key）' : 'secret_xxxx 或 ntn_xxxx',
                value: apiKeyInput,
                onChange: function (e) { setApiKeyInput(e.target.value); }
              })
            ]),
            React.createElement('div', { key: 'f2' }, [
              React.createElement('label', { key: 'l2', style: { display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500, color: 'var(--dsw-alias-label-primary, inherit)' } }, 'DSH 根页面 ID (Root Page ID):'),
              React.createElement('input', {
                key: 'i2',
                type: 'text',
                style: {
                  width: '100%', padding: '10px 14px', boxSizing: 'border-box',
                  background: 'var(--dsw-alias-bg-base, #fff)',
                  border: '1px solid var(--dsw-alias-border-l2, #ccc)',
                  color: 'var(--dsw-alias-label-primary, #000)',
                  borderRadius: 8, outline: 'none', fontSize: 14
                },
                placeholder: 'Notion 中 DSH 页面的 32位 UUID 或链接后缀',
                value: defaultPageInput,
                onChange: function (e) { setDefaultPageInput(e.target.value); }
              }),
              React.createElement('p', { key: 'hint', style: { margin: '6px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #888)' } },
                '所有新建的独立文档页面（Pages）和数据表（Databases）都将统一收拢保存在此 DSH 根页面下。'
              )
            ]),
            React.createElement('div', { key: 'f4', style: { display: 'flex', gap: 12, marginTop: 8 } }, [
              React.createElement('button', {
                key: 'b-test',
                style: {
                  padding: '9px 20px',
                  background: 'var(--dsw-alias-brand-primary, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                },
                onClick: testConnection
              }, loading ? '正在探测连通性...' : '⚡ 填入即测 (测试当前输入)'),
              React.createElement('button', {
                key: 'b-save',
                style: {
                  padding: '9px 20px',
                  background: 'var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.8))',
                  border: '1px solid var(--dsw-alias-border-l2, #ddd)',
                  color: 'var(--dsw-alias-label-primary, #333)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 500
                },
                onClick: saveSettings
              }, '保存配置')
            ]),
            testResult ? React.createElement('div', {
              key: 'res',
              style: {
                marginTop: 14, padding: 14, borderRadius: 8,
                background: testResult.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: '1px solid ' + (testResult.success ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'),
                color: testResult.success ? '#15803d' : '#b91c1c',
                fontSize: 13,
                lineHeight: 1.6
              }
            }, testResult.success ? [
              React.createElement('div', { key: 'r1', style: { fontWeight: 600, fontSize: 14, marginBottom: 4 } }, '✅ Notion API 鉴权连通成功！'),
              React.createElement('div', { key: 'r2' }, '集成应用名称: ' + ((testResult.user && testResult.user.name) || 'Notion Bot')),
              testResult.pageCheck ? React.createElement('div', { key: 'r4' }, testResult.pageCheck.ok ? ('✅ DSH 根页面有效') : ('❌ DSH 根页面检测失败: ' + testResult.pageCheck.error)) : null
            ] : ('❌ 连接测试未通过: ' + testResult.error)) : null
          ])
        ]);
      }

      return React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', color: '#e4e4e7', fontFamily: 'system-ui, sans-serif' }
      }, [
        headerElement,
        React.createElement('div', {
          key: 'main-content',
          style: { flex: 1, overflowY: 'auto', padding: 24 }
        }, [bodyElement])
      ]);
    }

    var panelRoot = null;
    var panelContainer = null;

    var closePanel = function () {
      document.documentElement.removeAttribute('data-dsh-notion-active');
      var entryBtn = document.querySelector('[data-dsh-notion-entry]');
      if (entryBtn) entryBtn.removeAttribute('data-active');
    };

    var openPanel = function () {
      document.documentElement.removeAttribute('data-dsh-taskboard-active');
      document.documentElement.removeAttribute('data-dsh-ssh-active');
      document.documentElement.removeAttribute('data-dsh-mnemon-active');
      document.documentElement.removeAttribute('data-dsh-skill-explorer-active');
      document.documentElement.setAttribute('data-dsh-notion-active', '');
      window.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'notion' }));

      var entryBtn = document.querySelector('[data-dsh-notion-entry]');
      if (entryBtn) entryBtn.setAttribute('data-active', '');

      var centerCol = document.querySelector('[class*="centerCol"], [data-pane="conversation"]');
      if (!centerCol) return;

      if (!panelContainer || !panelContainer.isConnected) {
        if (panelRoot) panelRoot.unmount();
        panelContainer = document.createElement('div');
        panelContainer.setAttribute('data-dsh-notion-view', '');
        centerCol.appendChild(panelContainer);
        panelRoot = ReactDOM.createRoot(panelContainer);
      }

      panelRoot.render(React.createElement(NotionPanel, { onClose: closePanel }));
    };

    var injectSidebarEntry = function () {
      if (document.querySelector('[data-dsh-notion-entry]')) return;

      var column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
      if (!column) return;

      // 找到真正的 sidebar 根容器
      var logoOwner = column.querySelector('[class*="logoRow"]');
      var root = (logoOwner && logoOwner.parentElement) ? logoOwner.parentElement : column.firstElementChild;
      if (!root) root = column;

      var newSessionBtn = root.querySelector('button[class*="newSession"]') || column.querySelector('button[class*="newSession"]');

      var entry = document.createElement('button');
      entry.type = 'button';
      entry.setAttribute('data-dsh-notion-entry', '');
      entry.setAttribute('data-dsh-plugin', 'notion');
      entry.setAttribute('data-dsh-part', 'sidebar-entry');
      entry.setAttribute('title', 'Notion 存储');
      entry.onclick = function () {
        if (document.documentElement.hasAttribute('data-dsh-notion-active')) {
          closePanel();
        } else {
          openPanel();
        }
      };

      var iconSpan = document.createElement('span');
      iconSpan.className = 'notion-icon-wrap';
      iconSpan.innerHTML = NOTION_ICON;

      var labelSpan = document.createElement('span');
      labelSpan.className = 'notion-label-text';
      labelSpan.textContent = 'Notion 存储';

      entry.appendChild(iconSpan);
      entry.appendChild(labelSpan);

      // 与任务看板、SSH、记忆系统、技能中心等保持同列
      var family = Array.from(root.children).filter(function (el) {
        return el instanceof HTMLElement && (
          el.hasAttribute('data-dsh-taskboard-entry') ||
          el.hasAttribute('data-dsh-ssh-entry') ||
          el.hasAttribute('data-dsh-mnemon-entry') ||
          el.hasAttribute('data-dsh-skill-explorer-entry') ||
          el.getAttribute('data-dsh-part') === 'sidebar-entry'
        );
      });
      if (family.length > 0) {
        family[family.length - 1].after(entry);
      } else if (newSessionBtn) {
        var row = newSessionBtn.closest('[class*="logoRow"]');
        var target = (row && row.parentElement === root) ? row : newSessionBtn;
        if (target.nextSibling) {
          root.insertBefore(entry, target.nextSibling);
        } else {
          root.appendChild(entry);
        }
      } else {
        root.appendChild(entry);
      }
    };

    function setupLifecycle() {
      injectStyles();
      var longPollTimer = null;

      var panelActivateHandler = function (e) {
        if (e.detail !== 'notion') closePanel();
      };
      window.addEventListener('dsh-panel-activate', panelActivateHandler);

      var clickHandler = function (e) {
        var target = e.target;
        if (target && target.closest && target.closest('[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="newSession"]')) {
          closePanel();
        }
      };
      document.addEventListener('click', clickHandler, true);

      injectSidebarEntry();

      // 全局 body 级别监听，确保 Shell 挂载出来或 React 重绘时自愈
      var bodyObserver = new MutationObserver(function () {
        injectSidebarEntry();
      });
      if (document.body) {
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }

      // 定时兜底（前 10 秒高频检测，之后低频巡检）
      var pollCount = 0;
      var pollTimer = setInterval(function () {
        injectSidebarEntry();
        pollCount++;
        if (pollCount > 30) {
          clearInterval(pollTimer);
          longPollTimer = setInterval(injectSidebarEntry, 2000);
        }
      }, 300);
      return function cleanup() {
        window.removeEventListener('dsh-panel-activate', panelActivateHandler);
        document.removeEventListener('click', clickHandler, true);
        if (bodyObserver) bodyObserver.disconnect();
        clearInterval(pollTimer);
        if (longPollTimer) clearInterval(longPollTimer);
        closePanel();
        var entry = document.querySelector('[data-dsh-notion-entry]');
        if (entry && entry.isConnected) { try { entry.remove(); } catch (_) {} }
        var styles = document.getElementById(CSS_ID);
        if (styles && styles.isConnected) { try { styles.remove(); } catch (_) {} }
        if (panelRoot) { try { panelRoot.unmount(); } catch (_) {} panelRoot = null; }
        if (panelContainer && panelContainer.isConnected) { try { panelContainer.remove(); } catch (_) {} panelContainer = null; }
      };
    }

    function apply(ctx) {
      var cleanup = setupLifecycle();
      ctx.effect(function () {
        return cleanup;
      });
    }

    // 立即执行一次初始化，防止动态加载时错过生命周期
    // 现在由 apply 触发，避免重复注册
    // if (typeof document !== 'undefined') {
    //   if (document.readyState === 'loading') {
    //     document.addEventListener('DOMContentLoaded', setupLifecycle);
    //   } else {
    //     setupLifecycle();
    //   }
    // }

    exports.apply = apply;
    exports.name = 'dsh-notion';
    return module.exports;
  }

  if (typeof window !== 'undefined' && window.__ModuleLoader__ && window.__ModuleLoader__.load) {
    window.__ModuleLoader__.load({
      id: 'dsh-notion',
      factory: function (require) {
        var module = { exports: {} };
        initModule(require, module, module.exports);
        return module.exports;
      }
    });
  } else if (typeof module !== 'undefined' && module.exports) {
    initModule(require, module, module.exports);
  }
})();
