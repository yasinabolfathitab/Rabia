const fs = require('fs');
let code = fs.readFileSync('src/lib/database.ts', 'utf-8');

const newFunc = `
export async function forceUpdateSupabaseMenu() {
  const FORCE_KEY = 'rabia_force_menu_v8';
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(FORCE_KEY)) return;
  
  const supabase = getSupabaseClient();
  if (!supabase) return; // If not connected, it's fine. If they connect later, they'll push local data anyway because we'll also update local.

  try {
    console.log("Force syncing new menu to Supabase...");
    // Delete all existing items
    await supabase.from('menu_items').delete().not('id', 'is', null);
    
    // Upsert the new ones
    const payload = INITIAL_MENU_ITEMS.map((m) => ({
      id: m.id,
      name: m.name,
      name_en: m.nameEn || null,
      category: m.category,
      price: m.price,
      description: m.description,
      ingredients: m.ingredients || [],
      image: m.image || null,
      is_available: parseIsAvailable(m.isAvailable),
      is_featured: m.isFeatured || false,
    }));
    
    await supabase.from('menu_items').upsert(payload);
    
    localStorage.setItem(MENU_KEY, JSON.stringify(INITIAL_MENU_ITEMS));
    localStorage.setItem(FORCE_KEY, 'true');
    emitRealtimeEvent('menu_updated');
    console.log("Force sync completed.");
  } catch (err) {
    console.error("Failed to force sync menu", err);
  }
}
`;

code += newFunc;
fs.writeFileSync('src/lib/database.ts', code);
