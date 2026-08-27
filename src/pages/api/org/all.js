import { PORTAL_API_BASE } from "@/lib/portalApiBase";
import { shouldUseLocalProfileMock } from "@/lib/localProfileMock";

export default async function orgAll(req, res) {
    try {
        const token = req.cookies.users_access_token || req.headers.authorization?.replace('Bearer ', '');
        // Сам реестр организаций у бэкенда открытый — токен здесь требует только
        // этот прокси. Под локальным мок-профилем портальной куки нет, и список
        // организаций в форме профиля оставался пустым: проверить выбор было
        // нечем. В обычном режиме требование токена не меняется.
        if (!token && !shouldUseLocalProfileMock(req, { fallbackWhenAuthMissing: true })) {
            return res.status(401).json({ success: false, error: "No token provided" });
        }

        const { 
            region,      
            name,        
            sort_by,  
            order,    
            limit = '50',      
            offset = '0'       
        } = req.query;


        // Валидация параметров
        const validSortBy = ['name', 'members'].includes(sort_by) ? sort_by : 'name';
        const validOrder = ['asc', 'desc'].includes(order) ? order : 'asc';
        // Потолок поднят с 200: в справочнике 4163 колледжа, и в Москве их 206 —
        // на прежнем пределе список организаций региона обрывался молча.
        const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
        const validOffset = Math.max(parseInt(offset) || 0, 0);

        // Формируем URL с параметрами
        const params = new URLSearchParams({
            sort_by: validSortBy,
            order: validOrder,
            limit: validLimit.toString(),
            offset: validOffset.toString()
        });

         // Добавляем опциональные параметры, только если они заданы
        if (region) {
            params.append('region', region);
        }   
        
        if (name) {
            params.append('name', name);
        }   

        const response_info = await fetch(`${PORTAL_API_BASE}/orgs/organizations/all?${params.toString()}`, {
            headers: {
                Accept: "application/json",
                Cookie: req.headers.cookie || "",
            },
        });

        if (!response_info.ok) {
            return res.status(response_info.status).json({
                success: false,
                error: "Failed to fetch organizations",
            });
        }

        const data = await response_info.json();

        return res.json({
            success: true,
            data: data,
        });
    } catch (err) { 
        return res.status(500).json({ success: false, error: err.message });
    }
}
