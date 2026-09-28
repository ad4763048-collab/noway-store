const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const [{ data: branding, error: brandingError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase.from('store_settings').select('value').eq('key', 'branding').maybeSingle(),
      supabase.from('product_categories').select('slug, name, sort_order').eq('is_active', true).order('sort_order'),
    ]);
    if (brandingError) throw brandingError;
    if (categoriesError) throw categoriesError;
    res.json({ branding: branding?.value || { storeName: 'NoWay', developer: 'Desenvolvido por Arthur Davi', copyright: 'Todos os direitos reservados - NoWay Group' }, categories });
  } catch (error) { next(error); }
});

module.exports = router;
