// ===== 工作计划管理系统 - Vue 3 应用 =====

// Supabase 配置
const SUPABASE_URL = 'https://aqdjghoroqzbasfkoinp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L4wpM4nLxHRYv5OucbQlLQ_X8EJMEOR';

// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const { createApp, ref, computed, onMounted, watch } = Vue;

createApp({
    setup() {
        // ===== 状态 =====
        const loading = ref(true);
        const user = ref(null);
        const profile = ref(null);
        const authMode = ref('login');
        const authForm = ref({ email: '', password: '', name: '', department: '' });
        const authError = ref('');

        // 布局状态
        const sidebarCollapsed = ref(false);
        const currentView = ref('dashboard');
        const showDrawer = ref(false);

        // 数据
        const myPlans = ref([]);
        const allPlans = ref([]);
        const visibilitySettings = ref([]);
        const allProfiles = ref([]);
        const systemConfig = ref([]);

        // 弹窗状态
        const showCommentModal = ref(false);
        const showEditModal = ref(false);
        const showDetailModal = ref(false);
        const showRegisterSuccess = ref(false);
        const selectedPlan = ref(null);
        const planComments = ref([]);
        const newComment = ref({ content: '', type: 'comment' });
        const editingPlan = ref({});
        const filterDepartment = ref('');
        const searchKeyword = ref('');

        // 可见性设置
        const newVisibility = ref({ owner_id: '', viewer_id: '' });

        // 管理设置
        const adminTab = ref('users');
        const currentParamTab = ref('category_type');
        const currentParamItems = ref([]);

        // 参数标签页配置
        const paramTabs = [
            { key: 'category_type', label: '职能<管理三角>' },
            { key: 'sub_category', label: '职能细分' },
            { key: 'scope', label: '覆盖范围' },
            { key: 'stage', label: '任务阶段' },
            { key: 'measurable', label: '可衡量(M)' },
            { key: 'achievable', label: '可实现(A)' },
            { key: 'relevant', label: '相关性(R)' }
        ];

        // 新计划表单
        const newPlan = ref({
            category: '', sub_category: '', main_project: '', sub_project: '',
            description: '', scope: [], stage: '', start_date: '', end_date: '',
            measurable: '', achievable: '', relevant: '',
            owner: '', collaborators: '', progress: 0, notes: '', value_plan: '', value_review: ''
        });

        // ===== 从数据库读取的配置选项 =====
        const categoryTypes = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'category_type' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const scopeOptions = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'scope' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const stageOptions = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'stage' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const measurableOptions = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'measurable' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const achievableOptions = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'achievable' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const relevantOptions = computed(() => {
            return systemConfig.value
                .filter(c => c.category === 'relevant' && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
        });

        const categoryOptions = computed(() => {
            const items = systemConfig.value
                .filter(c => c.category === 'sub_category' && c.parent_value === newPlan.value.category && c.is_active !== false)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => c.value);
            return items;
        });

        // ===== 计算属性 =====
        const isAdmin = computed(() => profile.value?.role === 'admin');
        const departments = computed(() => [...new Set(allProfiles.value.map(p => p.department).filter(Boolean))]);

        const viewTitle = computed(() => {
            const titles = {
                'dashboard': '🏠 驾驶舱',
                'my-plans': '📋 我的工作计划',
                'team-plans': '👥 团队工作计划',
                'admin': '⚙️ 管理设置'
            };
            return titles[currentView.value] || '';
        });

        const filteredAllPlans = computed(() => {
            let plans = allPlans.value;
            if (filterDepartment.value) plans = plans.filter(p => p.department === filterDepartment.value);
            if (searchKeyword.value) {
                const keyword = searchKeyword.value.toLowerCase();
                plans = plans.filter(p =>
                    p.description?.toLowerCase().includes(keyword) ||
                    p.main_project?.toLowerCase().includes(keyword) ||
                    p.director_name?.toLowerCase().includes(keyword)
                );
            }
            return plans;
        });

        // 驾驶舱统计
        const completedPlans = computed(() => myPlans.value.filter(p => p.progress >= 100).length);
        const inProgressPlans = computed(() => myPlans.value.filter(p => p.progress > 0 && p.progress < 100).length);
        const overduePlans = computed(() => myPlans.value.filter(p => isOverdue(p)).length);
        const avgProgress = computed(() => {
            if (myPlans.value.length === 0) return 0;
            return Math.round(myPlans.value.reduce((sum, p) => sum + (p.progress || 0), 0) / myPlans.value.length);
        });

        const categoryStats = computed(() => {
            const stats = {};
            myPlans.value.forEach(p => {
                if (p.category) {
                    stats[p.category] = (stats[p.category] || 0) + 1;
                }
            });
            return Object.entries(stats).map(([name, count]) => ({ name, count }));
        });

        const exceptionPlans = computed(() => {
            return myPlans.value.filter(p => isOverdue(p) || p.progress < 50);
        });

        const recentComments = computed(() => {
            // 这里应该从数据库获取最近评论，暂时返回空数组
            return [];
        });

        // ===== 方法 =====
        function onCategoryChange() {
            const items = systemConfig.value
                .filter(c => c.category === 'sub_category' && c.parent_value === newPlan.value.category)
                .sort((a, b) => a.sort_order - b.sort_order);
            newPlan.value.sub_category = items.length > 0 ? items[0].value : '';
        }

        function onEditCategoryChange() {
            const items = systemConfig.value
                .filter(c => c.category === 'sub_category' && c.parent_value === editingPlan.value.category)
                .sort((a, b) => a.sort_order - b.sort_order);
            if (items.length > 0 && !systemConfig.value.find(c => c.category === 'sub_category' && c.value === editingPlan.value.sub_category && c.parent_value === editingPlan.value.category)) {
                editingPlan.value.sub_category = items[0].value;
            }
        }

        function isOverdue(plan) {
            if (!plan.end_date || plan.progress >= 100) return false;
            return new Date(plan.end_date) < new Date();
        }

        function getExceptionType(plan) {
            if (isOverdue(plan)) return 'overdue';
            if (plan.progress < 50) return 'low-progress';
            return '';
        }

        function getExceptionLabel(plan) {
            if (isOverdue(plan)) return '已逾期';
            if (plan.progress < 50) return '进度缓慢';
            return '';
        }

        function resetNewPlan() {
            newPlan.value = {
                category: categoryTypes.value[0] || '',
                sub_category: '',
                main_project: '',
                sub_project: '',
                description: '',
                scope: [],
                stage: stageOptions.value[0] || '',
                start_date: '',
                end_date: '',
                measurable: measurableOptions.value[0] || '',
                achievable: achievableOptions.value[0] || '',
                relevant: relevantOptions.value[0] || '',
                owner: '',
                collaborators: '',
                progress: 0,
                notes: '',
                value_plan: '',
                value_review: ''
            };
            onCategoryChange();
        }

        function openDrawer() {
            resetNewPlan();
            showDrawer.value = true;
        }

        function closeDrawer() {
            showDrawer.value = false;
        }

        async function handleAuth() {
            authError.value = '';
            try {
                if (authMode.value === 'login') {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: authForm.value.email,
                        password: authForm.value.password
                    });
                    if (error) throw error;
                    user.value = data.user;
                    await fetchProfile();
                } else {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: authForm.value.email,
                        password: authForm.value.password,
                        options: {
                            data: {
                                name: authForm.value.name,
                                department: authForm.value.department
                            }
                        }
                    });
                    if (error) throw error;
                    showRegisterSuccess.value = true;
                }
            } catch (error) {
                authError.value = error.message;
            }
        }

        function closeRegisterSuccess() {
            showRegisterSuccess.value = false;
            authMode.value = 'login';
            authForm.value = { email: '', password: '', name: '', department: '' };
        }

        async function handleLogout() {
            await supabaseClient.auth.signOut();
            user.value = null;
            profile.value = null;
            myPlans.value = [];
            allPlans.value = [];
        }

        // ===== 数据获取 =====
        async function fetchProfile() {
            const { data } = await supabaseClient.from('profiles').select('*').eq('id', user.value.id).single();
            if (data) profile.value = data;
        }

        async function fetchMyPlans() {
            const { data } = await supabaseClient.from('plans').select('*').eq('user_id', user.value.id).order('created_at', { ascending: false });
            if (data) myPlans.value = data;
        }

        async function fetchAllPlans() {
            const { data } = await supabaseClient.from('plans').select('*').order('created_at', { ascending: false });
            if (data) allPlans.value = data;
        }

        async function fetchAllProfiles() {
            const { data } = await supabaseClient.from('profiles').select('*');
            if (data) allProfiles.value = data;
        }

        async function fetchVisibilitySettings() {
            const { data } = await supabaseClient.from('visibility_settings').select('*');
            if (data) visibilitySettings.value = data;
        }

        async function fetchSystemConfig() {
            const { data } = await supabaseClient.from('system_config').select('*').order('sort_order');
            if (data) systemConfig.value = data;
        }

        // ===== 计划操作 =====
        async function addPlan() {
            if (!newPlan.value.description) {
                alert('请填写任务描述');
                return;
            }
            const planData = {
                ...newPlan.value,
                user_id: user.value.id,
                department: profile.value.department,
                director_name: profile.value.name
            };
            const { data, error } = await supabaseClient.from('plans').insert(planData).select().single();
            if (data) {
                myPlans.value.unshift(data);
                allPlans.value.unshift(data);
                closeDrawer();
                alert('添加成功！');
            } else if (error) {
                alert('添加失败：' + error.message);
            }
        }

        function editPlan(plan) {
            editingPlan.value = { ...plan, scope: plan.scope || [] };
            showEditModal.value = true;
        }

        function viewPlanDetail(plan) {
            selectedPlan.value = plan;
            showDetailModal.value = true;
        }

        async function updatePlan() {
            const { data, error } = await supabaseClient.from('plans').update({
                category: editingPlan.value.category,
                sub_category: editingPlan.value.sub_category,
                main_project: editingPlan.value.main_project,
                sub_project: editingPlan.value.sub_project,
                description: editingPlan.value.description,
                stage: editingPlan.value.stage,
                start_date: editingPlan.value.start_date,
                end_date: editingPlan.value.end_date,
                measurable: editingPlan.value.measurable,
                achievable: editingPlan.value.achievable,
                relevant: editingPlan.value.relevant,
                owner: editingPlan.value.owner,
                collaborators: editingPlan.value.collaborators,
                progress: editingPlan.value.progress,
                notes: editingPlan.value.notes,
                value_plan: editingPlan.value.value_plan,
                value_review: editingPlan.value.value_review,
                updated_at: new Date().toISOString()
            }).eq('id', editingPlan.value.id).select().single();
            if (data) {
                const index = myPlans.value.findIndex(p => p.id === data.id);
                if (index > -1) myPlans.value[index] = data;
                const allIndex = allPlans.value.findIndex(p => p.id === data.id);
                if (allIndex > -1) allPlans.value[allIndex] = data;
                showEditModal.value = false;
                alert('更新成功！');
            } else if (error) {
                alert('更新失败：' + error.message);
            }
        }

        async function deletePlan(planId) {
            if (!confirm('确定要删除这条计划吗？')) return;
            const { error } = await supabaseClient.from('plans').delete().eq('id', planId);
            if (!error) {
                myPlans.value = myPlans.value.filter(p => p.id !== planId);
                allPlans.value = allPlans.value.filter(p => p.id !== planId);
                alert('删除成功！');
            } else {
                alert('删除失败：' + error.message);
            }
        }

        // ===== 评论 =====
        async function showComments(plan) {
            selectedPlan.value = plan;
            showCommentModal.value = true;
            const { data } = await supabaseClient.from('comments').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true });
            if (data) planComments.value = data;
        }

        async function addComment() {
            if (!newComment.value.content) return;
            const { data, error } = await supabaseClient.from('comments').insert({
                plan_id: selectedPlan.value.id,
                user_id: user.value.id,
                content: newComment.value.content,
                type: newComment.value.type
            }).select().single();
            if (data) {
                planComments.value.push(data);
                newComment.value = { content: '', type: 'comment' };
            } else if (error) {
                alert('评论失败：' + error.message);
            }
        }

        // ===== 管理员功能 =====
        async function setAdmin(userId) {
            const { error } = await supabaseClient.from('profiles').update({ role: 'admin' }).eq('id', userId);
            if (!error) {
                await fetchAllProfiles();
                alert('设置成功！');
            } else {
                alert('设置失败：' + error.message);
            }
        }

        async function removeAdmin(userId) {
            const { error } = await supabaseClient.from('profiles').update({ role: 'user' }).eq('id', userId);
            if (!error) {
                await fetchAllProfiles();
                alert('取消成功！');
            } else {
                alert('取消失败：' + error.message);
            }
        }

        async function addVisibilitySetting() {
            if (!newVisibility.value.owner_id || !newVisibility.value.viewer_id) {
                alert('请选择计划拥有者和可见者');
                return;
            }
            const { data, error } = await supabaseClient.from('visibility_settings')
                .insert({
                    owner_id: newVisibility.value.owner_id,
                    viewer_id: newVisibility.value.viewer_id,
                    can_view: true
                })
                .select().single();
            if (data) {
                visibilitySettings.value.push(data);
                newVisibility.value = { owner_id: '', viewer_id: '' };
            } else {
                alert('添加失败：' + error.message);
            }
        }

        async function updateVisibility(setting) {
            await supabaseClient.from('visibility_settings').update({ can_view: setting.can_view }).eq('id', setting.id);
        }

        async function deleteVisibilitySetting(settingId) {
            const { error } = await supabaseClient.from('visibility_settings').delete().eq('id', settingId);
            if (!error) {
                visibilitySettings.value = visibilitySettings.value.filter(s => s.id !== settingId);
            }
        }

        // ===== 系统参数管理 =====
        function loadParamConfig(category) {
            currentParamItems.value = systemConfig.value
                .filter(c => c.category === category)
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(c => ({ ...c }));
        }

        function getCurrentParamLabel() {
            const tab = paramTabs.find(t => t.key === currentParamTab.value);
            return tab ? tab.label : '';
        }

        function getSubCategoryItems(parentValue) {
            return currentParamItems.value.filter(c => c.parent_value === parentValue);
        }

        function addParamItem() {
            if (currentParamTab.value === 'sub_category') {
                // 对于职能细分，需要指定父级
                const firstCategory = categoryTypes.value[0];
                currentParamItems.value.push({
                    category: 'sub_category',
                    value: '',
                    parent_value: firstCategory,
                    sort_order: currentParamItems.value.length + 1,
                    is_active: true,
                    isNew: true
                });
            } else {
                currentParamItems.value.push({
                    category: currentParamTab.value,
                    value: '',
                    sort_order: currentParamItems.value.length + 1,
                    is_active: true,
                    isNew: true
                });
            }
        }

        async function removeParamItem(item) {
            if (item.isNew) {
                currentParamItems.value = currentParamItems.value.filter(i => i !== item);
            } else if (item.id) {
                const { error } = await supabaseClient.from('system_config').delete().eq('id', item.id);
                if (!error) {
                    currentParamItems.value = currentParamItems.value.filter(i => i.id !== item.id);
                    systemConfig.value = systemConfig.value.filter(c => c.id !== item.id);
                }
            }
        }

        async function saveParamConfig() {
            try {
                for (const item of currentParamItems.value) {
                    if (!item.value.trim()) continue;

                    if (item.isNew) {
                        // 新增
                        const { data, error } = await supabaseClient.from('system_config')
                            .insert({
                                category: item.category,
                                value: item.value,
                                parent_value: item.parent_value || null,
                                sort_order: item.sort_order,
                                is_active: item.is_active
                            })
                            .select()
                            .single();
                        if (data) {
                            systemConfig.value.push(data);
                            item.id = data.id;
                            delete item.isNew;
                        }
                    } else if (item.id) {
                        // 更新
                        await supabaseClient.from('system_config')
                            .update({
                                value: item.value,
                                sort_order: item.sort_order,
                                is_active: item.is_active,
                                parent_value: item.parent_value || null
                            })
                            .eq('id', item.id);
                        // 更新本地缓存
                        const idx = systemConfig.value.findIndex(c => c.id === item.id);
                        if (idx > -1) {
                            systemConfig.value[idx] = { ...systemConfig.value[idx], ...item };
                        }
                    }
                }
                alert('保存成功！');
            } catch (error) {
                alert('保存失败：' + error.message);
            }
        }

        // ===== Excel 功能 =====
        function downloadTemplate() {
            const templateData = [
                {
                    '职能<管理三角>': categoryTypes.value[0] || '业务发展维度',
                    '职能细分': '',
                    '主项目名称': '1.预算与预测体系',
                    '子项目名称': '现金流预测',
                    '任务描述': '建立滚动预测模型，确保月度公司级与业务线战略目标与预算偏差≤10%',
                    '覆盖范围': '业务主体,中后台',
                    '任务阶段': stageOptions.value[0] || '常规支撑',
                    '开始日期': '2026-03-01',
                    '结束日期': '2026-06-30',
                    '可衡量(M)': measurableOptions.value[0] || '可计量',
                    '可实现(A)': achievableOptions.value[0] || '一般',
                    '相关性(R)': relevantOptions.value[0] || '业务-强关联',
                    '负责人': '张三',
                    '协同人': '李四,王五',
                    '当下进度': 0,
                    '备注': '示例备注',
                    '价值计划': '提升财务可视性与控制力',
                    '价值评价': ''
                }
            ];

            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '年度计划模板');

            const colWidths = [
                { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 40 },
                { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
                { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
                { wch: 20 }, { wch: 20 }, { wch: 20 }
            ];
            worksheet['!cols'] = colWidths;

            XLSX.writeFile(workbook, '年度计划导入模板.xlsx');
        }

        async function handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    if (typeof dateValue === 'number') {
                        const date = new Date((dateValue - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    if (typeof dateValue === 'string') {
                        const cleaned = dateValue.trim();
                        if (!cleaned) return null;
                        const date = new Date(cleaned);
                        if (!isNaN(date.getTime())) {
                            return date.toISOString().split('T')[0];
                        }
                    }
                    return null;
                };

                const parseProgress = (value) => {
                    if (!value) return 0;
                    if (typeof value === 'number') return Math.min(100, Math.max(0, Math.round(value * 100)));
                    if (typeof value === 'string') {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            return num <= 1 ? Math.round(num * 100) : Math.min(100, Math.max(0, Math.round(num)));
                        }
                    }
                    return 0;
                };

                let importCount = 0;
                let errorCount = 0;

                for (const row of jsonData) {
                    const description = row['任务描述'] || row['描述'] || '';
                    if (!description.trim()) continue;

                    const planData = {
                        user_id: user.value.id,
                        department: profile.value.department,
                        director_name: profile.value.name,
                        category: row['职能<管理三角>'] || row['职能分类'] || categoryTypes.value[0] || '',
                        sub_category: row['职能细分'] || '',
                        main_project: row['主项目名称'] || row['主项目'] || '',
                        sub_project: row['子项目名称'] || row['子项目'] || '',
                        description: description,
                        scope: row['覆盖范围'] ? row['覆盖范围'].toString().split(/[,，]/).map(s => s.trim()).filter(s => s) : [],
                        stage: row['任务阶段'] || stageOptions.value[0] || '',
                        start_date: parseDate(row['开始日期'] || row['预计开始时间']),
                        end_date: parseDate(row['结束日期'] || row['预计结束时间']),
                        measurable: row['可衡量(M)'] || row['可衡量'] || measurableOptions.value[0] || '',
                        achievable: row['可实现(A)'] || row['可实现'] || achievableOptions.value[0] || '',
                        relevant: row['相关性(R)'] || row['相关性'] || relevantOptions.value[0] || '',
                        owner: row['负责人'] || '',
                        collaborators: row['协同人'] || '',
                        progress: parseProgress(row['当下进度'] || row['进度']),
                        notes: row['备注'] || '',
                        value_plan: row['价值计划'] || '',
                        value_review: row['价值评价'] || ''
                    };

                    const { data: result, error } = await supabaseClient.from('plans').insert(planData).select().single();
                    if (result) {
                        myPlans.value.unshift(result);
                        allPlans.value.unshift(result);
                        importCount++;
                    } else {
                        console.error('导入失败:', error);
                        errorCount++;
                    }
                }

                event.target.value = '';

                if (errorCount > 0) {
                    alert(`导入完成！成功 ${importCount} 条，失败 ${errorCount} 条`);
                } else {
                    alert(`成功导入 ${importCount} 条计划！`);
                }
            } catch (error) {
                console.error('导入错误:', error);
                alert('导入失败：' + error.message);
            }
        }

        // ===== 工具函数 =====
        function getUserName(userId) {
            const p = allProfiles.value.find(p => p.id === userId);
            return p?.name || '未知用户';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // ===== 生命周期 =====
        onMounted(async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user) {
                user.value = session.user;
                await fetchProfile();
                await fetchSystemConfig();
                await fetchMyPlans();
                await fetchAllPlans();
                await fetchAllProfiles();
                if (isAdmin.value) await fetchVisibilitySettings();
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    user.value = session.user;
                    await fetchProfile();
                    await fetchSystemConfig();
                    await fetchMyPlans();
                    await fetchAllPlans();
                    await fetchAllProfiles();
                    if (isAdmin.value) await fetchVisibilitySettings();
                } else if (event === 'SIGNED_OUT') {
                    user.value = null;
                    profile.value = null;
                    myPlans.value = [];
                    allPlans.value = [];
                }
            });
            loading.value = false;
        });

        return {
            // 状态
            loading, user, profile, authMode, authForm, authError,
            sidebarCollapsed, currentView, showDrawer,
            myPlans, allPlans, visibilitySettings, allProfiles, systemConfig,
            showCommentModal, showEditModal, showDetailModal, showRegisterSuccess,
            selectedPlan, planComments, newComment, editingPlan,
            filterDepartment, searchKeyword, newPlan, newVisibility,

            // 管理设置
            adminTab, currentParamTab, currentParamItems, paramTabs,

            // 配置选项
            categoryTypes, scopeOptions, stageOptions, categoryOptions,
            measurableOptions, achievableOptions, relevantOptions,

            // 计算属性
            isAdmin, departments, viewTitle, filteredAllPlans,
            completedPlans, inProgressPlans, overduePlans, avgProgress,
            categoryStats, exceptionPlans, recentComments,

            // 方法
            onCategoryChange, onEditCategoryChange, resetNewPlan,
            openDrawer, closeDrawer,
            handleAuth, handleLogout, closeRegisterSuccess,
            addPlan, editPlan, updatePlan, deletePlan,
            showComments, addComment, viewPlanDetail,
            handleFileImport, downloadTemplate,

            // 管理员
            setAdmin, removeAdmin,
            addVisibilitySetting, updateVisibility, deleteVisibilitySetting,

            // 参数管理
            loadParamConfig, getCurrentParamLabel, getSubCategoryItems,
            addParamItem, removeParamItem, saveParamConfig,

            // 工具
            getUserName, formatDate, isOverdue,
            getExceptionType, getExceptionLabel
        };
    }
}).mount('#app');
