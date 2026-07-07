import React from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * CategoryPage artıq müstəqil layout deyil — filter UI-nın həmişə görünməsi və
 * bütün məhsul siyahılarında eyni davranış üçün `/products?category=<name>`
 * səhifəsinə yönləndiririk. Bu, "filter gah var, gah yox" problemini kökündən həll edir.
 */
const CategoryPage: React.FC = () => {
  const { category } = useParams<{ category: string }>();

  if (!category) {
    return <Navigate to="/products" replace />;
  }

  return (
    <Navigate
      to={`/products?category=${encodeURIComponent(category)}`}
      replace
    />
  );
};

export default CategoryPage;
