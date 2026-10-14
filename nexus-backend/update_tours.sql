-- Atualizar tour configs para que as FAQs de bids tenham passos interativos com Ghost Cursor
UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-header]", "action": "highlight", "wait_for_click": false, "label": "Cabeçalho do Radar"}]}' WHERE category = 'bids' AND sort_order = 1;

UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-actions] button:first-child", "action": "ghost_cursor", "wait_for_click": true, "label": "Buscar Licitações"}]}' WHERE category = 'bids' AND sort_order = 2;

UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-kpis]", "action": "highlight", "wait_for_click": false, "label": "Indicadores KPI"}]}' WHERE category = 'bids' AND sort_order = 3;

UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-actions] button:nth-child(2)", "action": "ghost_cursor", "wait_for_click": true, "label": "Gerenciar Alertas"}]}' WHERE category = 'bids' AND sort_order = 4;

UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-actions] button:nth-child(3)", "action": "ghost_cursor", "wait_for_click": true, "label": "Meus Nichos"}]}' WHERE category = 'bids' AND sort_order = 5;

UPDATE luna_knowledge SET tour_config = '{"steps": [{"selector": "[data-tour=bids-distribution]", "action": "highlight", "wait_for_click": false, "label": "Distribuição Geográfica"}]}' WHERE category = 'bids' AND sort_order = 6;
