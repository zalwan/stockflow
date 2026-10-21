INSERT INTO products(sku,name,price,is_active) VALUES
 ('KRT-A4-80','Kertas A4 80 gsm',65000,true), ('PLP-BLU-12','Pulpen biru · isi 12',32000,true),
 ('BKU-A5-100','Buku catatan A5',18000,true), ('MAP-CLR-10','Map plastik · isi 10',24000,true),
 ('TNT-BLK-01','Tinta printer hitam',145000,true), ('TNT-CYN-01','Tinta printer cyan',145000,true),
 ('STP-MED-01','Stapler medium',42000,true), ('ISI-STP-10','Isi staples no. 10',8000,true),
 ('LKM-BRN-48','Lakban cokelat 48 mm',16000,true), ('BXS-30-20','Kardus 30 × 20 cm',7500,true),
 ('BUB-WRP-10','Bubble wrap 10 meter',38000,true), ('LBL-THM-50','Label thermal 50 mm',55000,true),
 ('AMP-BRN-10','Amplop cokelat · isi 10',12000,false), ('SPDL-RED-01','Spidol merah',11000,false);
INSERT INTO stock_movements(product_id,type,qty,note,created_at)
 SELECT id,'in',CASE WHEN id%4=0 THEN 8 WHEN id%5=0 THEN 4 ELSE 40+id END,'Stok awal gudang',now()-interval '2 days' FROM products;
UPDATE products p SET stock=(SELECT sum(qty) FROM stock_movements WHERE product_id=p.id);
INSERT INTO sales_orders(customer,total,created_at) VALUES
 ('PT Ruang Kerja Nusantara',194000,now()-interval '5 hours'), ('Toko Sinar Pagi',67000,now()-interval '2 hours');
INSERT INTO sales_order_items(order_id,sku,qty,unit_price) VALUES
 (1,'KRT-A4-80',2,65000),(1,'PLP-BLU-12',2,32000),
 (2,'BXS-30-20',2,7500),(2,'LKM-BRN-48',1,16000),(2,'BKU-A5-100',2,18000);
INSERT INTO stock_movements(product_id,type,qty,note,created_at)
 SELECT p.id,'out',i.qty,'Order #'||i.order_id,o.created_at FROM sales_order_items i JOIN products p ON p.sku=i.sku JOIN sales_orders o ON o.id=i.order_id;
UPDATE products p SET stock=(SELECT sum(CASE WHEN type='in' THEN qty ELSE -qty END) FROM stock_movements WHERE product_id=p.id);
