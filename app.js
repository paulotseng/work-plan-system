// ===== 年度工作计划系统 - Vue 3 应用 =====

// Supabase 配置
const SUPABASE_URL = 'https://aqdjghoroqzbasfkoinp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_L4wpM4nLxHRYv5OucbQlLQ_X8EJMEOR';

// 初始化 Supabase 客户端
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // ===== 状态 =====
        const loading = ref(true);
        const user = ref(null);
        const profile = ref(null);
        const authMode = ref('login');
        const authForm = ref({ email: '', password: '', name: '', department: '' });
        const authError = ref('');

        const currentView = ref('my-plans');
        const myPlans = ref([]);
        const allPlans = ref([]);
        const visibilitySettings = ref([]);
        const allProfiles = ref([]);

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

        // ===== 选项配置 =====
        const scopeOptions = ['业务主体', '中后台', 'HRC', 'ODC', 'FNC', 'DIC', 'AIC', '万马', '嘀嗒嘀', '斯贝斯', '恒洋如易', '靠谱', 'CCC', '其他'];
        const stageOptions = ['方法论--设计', '方法论--推广', '方法论--应用', '方法论--迭代', '方法论--审计', '常规支撑', '专项支撑', '其他规划'];
        const subCategoryMap = {
            '组织发展维度': ['组织管理', '流程管理', '方法论管理', '异常管理'],
            '人力资源维度': ['招聘配置', '绩效管理', '员工关系'],
            '业务发展维度': []
        };

        // ===== 新计划表单 =====
        const newPlan = ref({
            category: '业务发展维度', sub_category: '', main_project: '', sub_project: '',
            description: '', scope: [], stage: '常规支撑', start_date: '', end_date: '',
            measurable: '可计量', achievable: '一般', relevant: '业务-强关联',
            owner: '', collaborators: '', progress: 0, notes: '', value_plan: '', value_review: ''
        });

        // ===== 计算属性 =====
        const isAdmin = computed(() => profile.value?.role === 'admin');
        const categoryOptions = computed(() => subCategoryMap[newPlan.value.category] || []);
        const departments = computed(() => [...new Set(allProfiles.value.map(p => p.department).filter(Boolean))]);
        const filteredAllPlans = computed(() => {
            let plans = allPlans.value;
            if (filterDepartment.value) plans = plans.filter(p => p.department === filterDepartment.value);
            if (searchKeyword.value) {
                const keyword = searchKeyword.value.toLowerCase();
                plans = plans.filter(p => p.description?.toLowerCase().includes(keyword) || p.main_project?.toLowerCase().includes(keyword) || p.director_name?.toLowerCase().includes(keyword));
            }
            return plans;
        });

        // ===== 方法 =====
        function onCategoryChange() {
            const options = subCategoryMap[newPlan.value.category];
            newPlan.value.sub_category = options?.length > 0 ? options[0] : '';
        }

        function resetNewPlan() {
            newPlan.value = {
                category: '业务发展维度', sub_category: '', main_project: '', sub_project: '',
                description: '', scope: [], stage: '常规支撑', start_date: '', end_date: '',
                measurable: '可计量', achievable: '一般', relevant: '业务-强关联',
                owner: '', collaborators: '', progress: 0, notes: '', value_plan: '', value_review: ''
            };
        }

        async function handleAuth() {
            authError.value = '';
            try {
                if (authMode.value === 'login') {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: authForm.value.email, password: authForm.value.password
                    });
                    if (error) throw error;
                    user.value = data.user;
                    await fetchProfile();
                } else {
                    const { data, error } = await supabaseClient.auth.signUp({
                        email: authForm.value.email, password: authForm.value.password,
                        options: { data: { name: authForm.value.name, department: authForm.value.department } }
                    });
                    if (error) throw error;
                    // 显示注册成功弹窗
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

        async function addPlan() {
            if (!newPlan.value.description) { alert('请填写任务描述'); return; }
            const planData = { ...newPlan.value, user_id: user.value.id, department: profile.value.department, director_name: profile.value.name };
            const { data, error } = await supabaseClient.from('plans').insert(planData).select().single();
            if (data) { myPlans.value.unshift(data); allPlans.value.unshift(data); resetNewPlan(); alert('添加成功！'); }
            else if (error) alert('添加失败：' + error.message);
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
            } else if (error) alert('更新失败：' + error.message);
        }

        async function deletePlan(planId) {
            if (!confirm('确定要删除这条计划吗？')) return;
            const { error } = await supabaseClient.from('plans').delete().eq('id', planId);
            if (!error) {
                myPlans.value = myPlans.value.filter(p => p.id !== planId);
                allPlans.value = allPlans.value.filter(p => p.id !== planId);
                alert('删除成功！');
            } else alert('删除失败：' + error.message);
        }

        async function showComments(plan) {
            selectedPlan.value = plan;
            showCommentModal.value = true;
            const { data } = await supabaseClient.from('comments').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true });
            if (data) planComments.value = data;
        }

        async function addComment() {
            if (!newComment.value.content) return;
            const { data, error } = await supabaseClient.from('comments').insert({
                plan_id: selectedPlan.value.id, user_id: user.value.id,
                content: newComment.value.content, type: newComment.value.type
            }).select().single();
            if (data) { planComments.value.push(data); newComment.value = { content: '', type: 'comment' }; }
            else if (error) alert('评论失败：' + error.message);
        }

        // ===== 管理员功能 =====
        async function setAdmin(userId) {
            const { error } = await supabaseClient.from('profiles').update({ role: 'admin' }).eq('id', userId);
            if (!error) {
                await fetchAllProfiles();
                alert('设置成功！');
            } else alert('设置失败：' + error.message);
        }

        async function removeAdmin(userId) {
            const { error } = await supabaseClient.from('profiles').update({ role: 'user' }).eq('id', userId);
            if (!error) {
                await fetchAllProfiles();
                alert('取消成功！');
            } else alert('取消失败：' + error.message);
        }

        async function addVisibilitySetting() {
            if (!newVisibility.value.owner_id || !newVisibility.value.viewer_id) {
                alert('请选择计划拥有者和可见者');
                return;
            }
            const { data, error } = await supabaseClient.from('visibility_settings')
                .insert({ owner_id: newVisibility.value.owner_id, viewer_id: newVisibility.value.viewer_id, can_view: true })
                .select().single();
            if (data) {
                visibilitySettings.value.push(data);
                newVisibility.value = { owner_id: '', viewer_id: '' };
            } else alert('添加失败：' + error.message);
        }

        async function updateVisibility(setting) {
            await supabaseClient.from('visibility_settings').update({ can_view: setting.can_view }).eq('id', setting.id);
        }

        async function deleteVisibilitySetting(settingId) {
            const { error } = await supabaseClient.from('visibility_settings').delete().eq('id', settingId);
            if (!error) visibilitySettings.value = visibilitySettings.value.filter(s => s.id !== settingId);
        }

        // ===== 下载模板 =====
        function downloadTemplate() {
            const templateData = [
                {
                    '职能<管理三角>': '业务发展维度',
                    '职能细分': '财务管理',
                    '主项目名称': '1.预算与预测体系',
                    '子项目名称': '现金流预测',
                    '任务描述': '建立滚动预测模型，确保月度公司级与业务线战略目标与预算偏差≤10%',
                    '覆盖范围': '业务主体,中后台',
                    '任务阶段': '常规支撑',
                    '开始日期': '2026-03-01',
                    '结束日期': '2026-06-30',
                    '可衡量(M)': '可计量',
                    '可实现(A)': '一般',
                    '相关性(R)': '业务-强关联',
                    '负责人': '张三',
                    '协同人': '李四,王五',
                    '当下进度': 0,
                    '备注': '示例备注',
                    '价值计划': '提升财务可视性与控制力',
                    '价值评价': ''
                },
                {
                    '职能<管理三角>': '组织发展维度',
                    '职能细分': '组织管理',
                    '主项目名称': '1.组织优化',
                    '子项目名称': '海外公司架构设计',
                    '任务描述': '新加坡总公司成立，支撑全球化战略',
                    '覆盖范围': '业务主体',
                    '任务阶段': '专项支撑',
                    '开始日期': '',
                    '结束日期': '',
                    '可衡量(M)': '可感知',
                    '可实现(A)': '困难',
                    '相关性(R)': '管理-强关联',
                    '负责人': '张三',
                    '协同人': '',
                    '当下进度': 0.1,
                    '备注': '',
                    '价值计划': '',
                    '价值评价': ''
                }
            ];

            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '年度计划模板');

            // 设置列宽
            const colWidths = [
                { wch: 15 }, // 职能<管理三角>
                { wch: 12 }, // 职能细分
                { wch: 18 }, // 主项目名称
                { wch: 15 }, // 子项目名称
                { wch: 40 }, // 任务描述
                { wch: 20 }, // 覆盖范围
                { wch: 12 }, // 任务阶段
                { wch: 12 }, // 开始日期
                { wch: 12 }, // 结束日期
                { wch: 10 }, // 可衡量(M)
                { wch: 10 }, // 可实现(A)
                { wch: 12 }, // 相关性(R)
                { wch: 10 }, // 负责人
                { wch: 15 }, // 协同人
                { wch: 10 }, // 当下进度
                { wch: 20 }, // 备注
                { wch: 20 }, // 价值计划
                { wch: 20 }  // 价值评价
            ];
            worksheet['!cols'] = colWidths;

            XLSX.writeFile(workbook, '年度计划导入模板.xlsx');
        }

        // ===== Excel 导入 =====
        async function handleFileImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // 处理日期格式
                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    // 如果是Excel日期数字
                    if (typeof dateValue === 'number') {
                        const date = new Date((dateValue - 25569) * 86400 * 1000);
                        return date.toISOString().split('T')[0];
                    }
                    // 如果是字符串
                    if (typeof dateValue === 'string') {
                        const cleaned = dateValue.trim();
                        if (!cleaned) return null;
                        // 尝试解析日期
                        const date = new Date(cleaned);
                        if (!isNaN(date.getTime())) {
                            return date.toISOString().split('T')[0];
                        }
                    }
                    return null;
                };

                // 处理进度值
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
                    // 跳过没有描述的行
                    const description = row['任务描述'] || row['描述'] || '';
                    if (!description.trim()) continue;

                    const planData = {
                        user_id: user.value.id,
                        department: profile.value.department,
                        director_name: profile.value.name,
                        category: row['职能<管理三角>'] || row['职能分类'] || '业务发展维度',
                        sub_category: row['职能细分'] || '',
                        main_project: row['主项目名称'] || row['主项目'] || '',
                        sub_project: row['子项目名称'] || row['子项目'] || '',
                        description: description,
                        scope: row['覆盖范围'] ? row['覆盖范围'].toString().split(/[,，]/).map(s => s.trim()).filter(s => s) : [],
                        stage: row['任务阶段'] || '常规支撑',
                        start_date: parseDate(row['开始日期'] || row['预计开始时间']),
                        end_date: parseDate(row['结束日期'] || row['预计结束时间']),
                        measurable: row['可衡量(M)'] || row['可衡量'] || '可计量',
                        achievable: row['可实现(A)'] || row['可实现'] || '一般',
                        relevant: row['相关性(R)'] || row['相关性'] || '业务-强关联',
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

        function getUserName(userId) {
            const p = allProfiles.value.find(p => p.id === userId);
            return p?.name || '未知用户';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        // ===== 生命周期 =====
        onMounted(async () => {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session?.user) {
                user.value = session.user;
                await fetchProfile();
                await fetchMyPlans();
                await fetchAllPlans();
                await fetchAllProfiles();
                if (isAdmin.value) await fetchVisibilitySettings();
            }

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    user.value = session.user;
                    await fetchProfile();
                    await fetchMyPlans();
                    await fetchAllPlans();
                    await fetchAllProfiles();
                    if (isAdmin.value) await fetchVisibilitySettings();
                } else if (event === 'SIGNED_OUT') {
                    user.value = null; profile.value = null; myPlans.value = []; allPlans.value = [];
                }
            });
            loading.value = false;
        });

        return {
            loading, user, profile, authMode, authForm, authError, currentView, myPlans, allPlans,
            visibilitySettings, allProfiles, showCommentModal, showEditModal, showDetailModal,
            showRegisterSuccess, selectedPlan, planComments, newComment, editingPlan, filterDepartment, searchKeyword, newPlan,
            newVisibility, scopeOptions, stageOptions, categoryOptions, isAdmin, departments, filteredAllPlans,
            onCategoryChange, resetNewPlan, handleAuth, handleLogout, addPlan, editPlan, updatePlan,
            deletePlan, showComments, addComment, viewPlanDetail, handleFileImport, downloadTemplate,
            setAdmin, removeAdmin, addVisibilitySetting, updateVisibility, deleteVisibilitySetting,
            getUserName, formatDate, closeRegisterSuccess
        };
    }
}).mount('#app');
