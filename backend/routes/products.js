const express = require('express');
const { supabase } = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, category, name, description, price, old_price, tag, badge')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ products: data.map((product) => ({
      ...product,
      desc: product.description,
      oldPrice: product.old_price,
      old_price: undefined,
      description: undefined,
    })) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
