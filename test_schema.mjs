import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read supabase credentials from src/supabase.js
const content = fs.readFileSync('c:\\Users\\Marim\\Documents\\acai-kalix\\src\\supabase.js', 'utf8');
const urlMatch = content.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = content.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
    const supabase = createClient(urlMatch[1], keyMatch[1]);

    async function test() {
        // Test 1: product_recipes table
        const { error: err1 } = await supabase.from('product_recipes').select('*').limit(1);
        console.log('product_recipes table check:', err1 ? err1.message : 'EXISTS');

        // Test 2: recipe column in products
        const { error: err2 } = await supabase.from('products').select('recipe').limit(1);
        console.log('products.recipe column check:', err2 ? err2.message : 'EXISTS');

        // Test 3: unit column in products (Unidade de medida)
        const { error: err3 } = await supabase.from('products').select('unit').limit(1);
        console.log('products.unit column check:', err3 ? err3.message : 'EXISTS');
    }

    test();
} else {
    console.log('Could not find credentials');
}
